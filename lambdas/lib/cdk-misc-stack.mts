import * as cdk from 'aws-cdk-lib';
import {Duration, Tags} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as events from "aws-cdk-lib/aws-events";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as targets from "aws-cdk-lib/aws-scheduler-targets";
import * as sources from "aws-cdk-lib/aws-lambda-event-sources";
import {COMPONENT, DEPLOYMENT_BUCKET} from "./metadata.mts";

let ZIP_BUCKET: s3.IBucket | undefined = undefined;
let DATABASE_VPC: ec2.IVpc = undefined;
let PRIVATE_SUBNET_A: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_B: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_C: ec2.ISubnet = undefined;
let CONFIRM_LAMBDA: lambda.IFunction = undefined;
let ACCESS_DYNAMO: iam.PolicyDocument = undefined;
let DOWNLOADER_QUEUE: string | undefined;

export const RUNTIME = lambda.Runtime.NODEJS_22_X;
// bgg - access BoardGameGeek, needs to be public
// db - access to the database, needs to be private
// logging - ability to write to CloudWatch logs
// cw - ability to read CloudWatch metrics, needs to be public
// dynamo - access DynamoDB
// single - max concurrency 1
// downloader - access to send to downloader queue
type OptsType = "bgg" | "db" | "logging" | "cw" | "dynamo" | "single" | "sqs" | "ssm" | "message" | "downloader";

export class MiscStack extends cdk.Stack {
  // don't do this, it costs too much.
  // defineVpcEndpoints() {
  //   DATABASE_VPC.addInterfaceEndpoint("ep", {
  //     service: ec2.InterfaceVpcEndpointAwsService.SSM,
  //     open: true,
  //     ipAddressType: VpcEndpointIpAddressType.IPV4
  //   })
  //   DATABASE_VPC.addInterfaceEndpoint("ep2", {
  //     service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
  //     open: true,
  //     ipAddressType: VpcEndpointIpAddressType.IPV4
  //   })
  // }

  defineAccessDynamoPolicy(): iam.PolicyDocument {
    const accessDynamo = new iam.PolicyStatement();
    accessDynamo.addActions(
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:ConditionCheckItem",
        "dynamodb:DeleteItem",
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:GetRecords",
        "dynamodb:GetShardIterator",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:UpdateItem");
    accessDynamo.addResources(
        "arn:aws:dynamodb:ap-southeast-2:067508173724:table/websocket_connections",
        "arn:aws:dynamodb:ap-southeast-2:067508173724:table/geek_connections"
    );
    return new iam.PolicyDocument({
      statements: [accessDynamo]
    });
  }

  defineAuthStateMachine(threadFunc: lambda.Function): sfn.StateMachine {
    return new sfn.StateMachine(this, 'authStateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(
          new tasks.LambdaInvoke(this, "threadTask", {
            lambdaFunction: threadFunc,
          }).next(
              new tasks.LambdaInvoke(this, "confirmTask", {
                lambdaFunction: CONFIRM_LAMBDA,
              }).next(
                  new sfn.Succeed(this, "Thread processed")
              )
          )
      ),
    });
  }

  defineCountsStateMachine(cwFunction: lambda.Function, countFunction: lambda.Function) {
    return new sfn.StateMachine(this, 'countsStateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(
          new tasks.LambdaInvoke(this, "cwCountTask", {
            lambdaFunction: cwFunction,
          }).next(
              new tasks.LambdaInvoke(this, "dbCountTask", {
                lambdaFunction: countFunction,
              }).next(
                  new sfn.Succeed(this, "Counts processed")
              )
          )
      ),
    });
  }

  defineScheduleToInvokeAuth(machine: sfn.IStateMachine, n: number): scheduler.Schedule {
    const st1 = new iam.PolicyStatement();
    st1.addActions("states:StartExecution");
    st1.addResources(machine.stateMachineArn);
    const policies: Record<string, iam.PolicyDocument> = {
      "policy_invoke_auth_thread": new iam.PolicyDocument({
        statements: [st1]
      })
    };
    const role = new iam.Role(this, 'assumeAuthRole' + n, {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    return new scheduler.Schedule(this, `authSchedule${n}`, {
      schedule: events.Schedule.cron({ minute: '0' }),
      target: new targets.StepFunctionsStartExecution(machine, { role }),
      description: "Every hour, check the BGG auth thread."
    });
  }

  defineScheduleToInvokeDaily(func: lambda.Function, n: number): scheduler.Schedule {
    const role = new iam.Role(this, 'assumeDailyRole' + n, {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    return new scheduler.Schedule(this, `schedule_daily_${n}`, {
      schedule: scheduler.ScheduleExpression.rate(Duration.hours(24)),
      description: "Once per day run daily tasks, e.g. rebuild materialised views.",
      target: new targets.LambdaInvoke(func, { role })
    });
  }

  defineScheduleToInvokeCounts(machine: sfn.IStateMachine, n: number): scheduler.Schedule {
    const st1 = new iam.PolicyStatement();
    st1.addActions("states:StartExecution");
    st1.addResources(machine.stateMachineArn);
    const policies: Record<string, iam.PolicyDocument> = {
      "policy_invoke_counts_thread": new iam.PolicyDocument({
        statements: [st1]
      })
    };
    const role = new iam.Role(this, 'assumeCountsRole' + n, {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    return new scheduler.Schedule(this, `countsSchedule${n}`, {
      schedule: events.Schedule.rate(Duration.minutes(10)),
      target: new targets.StepFunctionsStartExecution(machine, { role }),
      description: "Every 10 minutes get data from CloudWatch and store it as observability metrics."
    });
  }

  /**
   *
   * @param name
   * @param handler
   * @param opts
   * @param subnetType - public means outside VPC, private means private subnet inside VPC.
   * @param n - a unique number for every function, used to generate unique names
   */
  defineLambda(name: string, handler: string, opts: OptsType[], subnetType: "public" | "private", n: number): lambda.Function {
    const role = this.defineRole(opts, name, n);
    const vpcOpts: Partial<lambda.FunctionProps> = {
      vpc: DATABASE_VPC,
      vpcSubnets: {
        subnets: [ PRIVATE_SUBNET_A, PRIVATE_SUBNET_B, PRIVATE_SUBNET_C ]
      }
    };
    const limitConcurrency: Partial<lambda.FunctionProps> = {
      reservedConcurrentExecutions: 1
    }
    const fProps: lambda.FunctionProps = {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET, COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
      allowPublicSubnet: true,
      environment: {
        "opts": JSON.stringify(opts),
        "type": subnetType
      },
      ...(subnetType === "public" ? {} : vpcOpts),
      ...((opts.indexOf("single") >= 0) ? limitConcurrency : {})
    };
    if (opts.indexOf("db") >= 0 && subnetType === "private") {
      // would need a VPC endpoint to get to secrets manager, and we don't want to pay for that
      fProps.environment.MYSQL_HOST = process.env.MYSQL_HOST;
      fProps.environment.MYSQL_USERNAME = process.env.MYSQL_USERNAME;
      fProps.environment.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;
      fProps.environment.MYSQL_DATABASE = process.env.MYSQL_DATABASE;
    }
    const f = new lambda.Function(this, name, fProps);
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  private definePolicies(opts: OptsType[], n: number) {
    const managedPolicies: iam.IManagedPolicy[] = [
      iam.ManagedPolicy.fromManagedPolicyName(this, "createEC2s" + n, "CreateEC2sForLambda"),
      iam.ManagedPolicy.fromManagedPolicyName(this, "writeLogs" + n, "WriteToCloudwatchLogs"),
    ];
    if (opts.includes("db")) {
      managedPolicies.push(iam.ManagedPolicy.fromManagedPolicyName(this, "dbSecrets" + n, "AccessDatabaseSecrets"))
    }
    return managedPolicies;
  }

  private defineRole(opts: OptsType[], name: string, n: number): iam.Role {
    const policies: Record<string, iam.PolicyDocument> = {};
    if (opts.indexOf("downloader") >= 0) {
      const access = new iam.PolicyStatement();
      access.addActions("sqs:SendMessage");
      access.addResources(DOWNLOADER_QUEUE);
      policies[`policy_${name}_dlq`] = new iam.PolicyDocument({
        statements: [access]
      });
    }
    if (opts.indexOf("message") >= 0) {
      const parameters = new iam.PolicyStatement();
      parameters.addActions("execute-api:ManageConnections");
      parameters.addResources(`arn:aws:execute-api:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:*`);
      policies[`policy_${name}_exa`] = new iam.PolicyDocument({
        statements: [parameters]
      });
    }
    if (opts.includes("ssm")) {
      const parameters = new iam.PolicyStatement();
      parameters.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters", "ssm:PutParameter");
      parameters.addResources(`arn:aws:ssm:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:parameter/extstats/*`);
      policies[`policy_${name}_ssm`] = new iam.PolicyDocument({
        statements: [parameters]
      });
    }
    if (opts.includes("bgg")) {
      const bggParameters = new iam.PolicyStatement();
      bggParameters.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters", "ssm:PutParameter");
      bggParameters.addResources(`arn:aws:ssm:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:parameter/extstats/authcheck*`);
      const bggSecrets = new iam.PolicyStatement();
      bggSecrets.addActions("secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret");
      bggSecrets.addResources(`arn:aws:secretsmanager:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:secret:extstats/bgg*`);

      policies[`policy_${name}_bgg`] = new iam.PolicyDocument({
        statements: [bggParameters, bggSecrets]
      });
    }
    if (opts.includes("logging")) {
      const loggingParameters = new iam.PolicyStatement();
      loggingParameters.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters");
      loggingParameters.addResources(`arn:aws:ssm:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:parameter/extstats/systemLogGroup*`);
      const loggingCloudWatch = new iam.PolicyStatement();
      loggingCloudWatch.addActions("logs:PutLogEvents", "logs:CreateLogStream", "logs:CreateLogGroup");
      loggingCloudWatch.addResources("*");

      policies[`policy_${name}_logging`] = new iam.PolicyDocument({
        statements: [loggingCloudWatch]
      });
    }
    if (opts.includes("cw")) {
      const cwPolicy = new iam.PolicyStatement();
      cwPolicy.addActions("cloudwatch:ListEntitiesForMetric", "cloudwatch:GetMetricData", "cloudwatch:GetMetricStatistics",
          "cloudwatch:GetMetricStream", "cloudwatch:ListMetricStreams", "cloudwatch:ListMetrics");
      cwPolicy.addResources("*");
      policies[`policy_${name}_cw`] = new iam.PolicyDocument({ statements: [cwPolicy] });
      const s3Policy = new iam.PolicyStatement();
      s3Policy.addActions("s3:ListAllMyBuckets");
      s3Policy.addResources("*");
      policies[`policy_${name}_s3`] = new iam.PolicyDocument({ statements: [s3Policy] });
    }
    if (opts.indexOf("dynamo") >= 0) {
      policies[`policy_${name}_dynamo`] = ACCESS_DYNAMO;
    }
    return new iam.Role(this, `role_${name}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: this.definePolicies(opts, n),
    });
  }

  defineMessageQueue(): sqs.Queue {
    return new sqs.Queue(this, "messageQueue", {
      queueName: "MessageQueue",
      visibilityTimeout: Duration.seconds(120)
    });
  }

  lookupExternalResources() {
    // resources external to this stack
    DATABASE_VPC = ec2.Vpc.fromLookup(this, "vpc", {vpcId: "vpc-5c8a7a3b"});
    PRIVATE_SUBNET_A = ec2.Subnet.fromSubnetId(this, "private a", "subnet-f565d0bc");
    PRIVATE_SUBNET_B = ec2.Subnet.fromSubnetId(this, "private b", "subnet-a865decf");
    PRIVATE_SUBNET_C = ec2.Subnet.fromSubnetId(this, "private c", "subnet-44646e1d");
    ZIP_BUCKET = s3.Bucket.fromBucketName(this, "bucket", DEPLOYMENT_BUCKET);
    CONFIRM_LAMBDA = lambda.Function.fromFunctionName(this, "confirmFunc", "auth_confirm");
    DOWNLOADER_QUEUE = cdk.Fn.importValue('downloader-OutputQueueARN');
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.lookupExternalResources();
    ACCESS_DYNAMO = this.defineAccessDynamoPolicy();

    // the VPC endpoint is so that the Lambdas inside the VPC can see the parameter store which is public.
    // We don't use it because it's expensive, so the Lambdas inside the VPC have to be given their settings as environment variables.
    // this.defineVpcEndpoints();
    const threadFunction = this.defineLambda("misc_auth_thread", "auththread.handler", ["bgg"], "public", 1);
    const sm = this.defineAuthStateMachine(threadFunction);
    const rule = this.defineScheduleToInvokeAuth(sm, 1);
    const countFunction = this.defineLambda("misc_counts", "counts.handler", ["db","dynamo"], "private", 4);
    const cwFunction = this.defineLambda("misc_cw", "cloudwatch.handler", ["cw"], "public", 5);
    const sm2 = this.defineCountsStateMachine(cwFunction, countFunction);
    const rule6 = this.defineScheduleToInvokeCounts(sm2, 6);
    const messageQueue = this.defineMessageQueue();
    const dailyFunction = this.defineLambda("misc_daily", "daily.dailyTasks", ["ssm", "downloader"], "public", 8);
    // schedules are the new way to do rules
    const schedule7 = this.defineScheduleToInvokeDaily(dailyFunction, 9);

    new cdk.CfnOutput(this, 'MessageQueue', {
      value: messageQueue.queueUrl,
      exportName: 'misc-MessageQueueURL'
    });

    let messageLambda: lambda.IFunction = this.defineLambda("misc_message", "message.handler", ["dynamo","single","sqs","ssm","message"], "public", 7);
    if (messageLambda) {
      const mapping = new sources.SqsEventSource(messageQueue, {batchSize: 10, enabled: false, maxBatchingWindow: Duration.seconds(3) });
      messageLambda.addEventSource(mapping);
      new cdk.CfnOutput(this, 'messageMapping', {
        value: mapping.eventSourceMappingId,
        exportName: 'misc-MessageMappingUUID'
      });
    } else {
      console.log("There isn't any message lambda");
    }
  }
}
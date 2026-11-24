import * as cdk from 'aws-cdk-lib';
import {Duration, Tags} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sources from "aws-cdk-lib/aws-lambda-event-sources";
import * as events from "aws-cdk-lib/aws-events";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as etargets from "aws-cdk-lib/aws-events-targets";
import * as targets from "aws-cdk-lib/aws-scheduler-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as logs from "aws-cdk-lib/aws-logs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import {CACHE_BUCKET, COMPONENT, DEPLOYMENT_BUCKET, LAMBDA_SPECS, INSIDE_LAMBDA_SPECS} from "./metadata.mts";

const RUNTIME = lambda.Runtime.NODEJS_24_X;

let ZIP_BUCKET: s3.IBucket | undefined = undefined;
let DATABASE_VPC: ec2.IVpc = undefined;
let PRIVATE_SUBNET_A: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_B: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_C: ec2.ISubnet = undefined;
let CONFIRM_LAMBDA: lambda.IFunction = undefined;
// prebuilt permissions
let LAMBDA_POLICIES: iam.IManagedPolicy[] = [];
let LAMBDA_POLICIES_WITH_DATABASE: iam.IManagedPolicy[] = [];
let ACCESS_DYNAMO = defineAccessDynamoPolicy();

function defineAccessDynamoPolicy(): iam.PolicyDocument {
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

// user authenticaion via BGG
class AuthConstruct extends Construct {
  constructor(stack: DownloadStack) {
    super(stack, "authConstruct");
    const role = this.defineAuthRole(stack);
    const threadFunction = this.defineAuthLambda(stack, role);
    const sm = this.defineAuthStateMachine(stack, threadFunction);
    this.defineAuthSchedule(stack, sm);
  }

  private defineAuthRole(stack: DownloadStack): iam.Role {
    const policies: Record<string, iam.PolicyDocument> = {};
    const bggParameters = new iam.PolicyStatement();
    bggParameters.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters", "ssm:PutParameter");
    bggParameters.addResources(`arn:aws:ssm:${stack.region}:${stack.account}:parameter/extstats/authcheck*`);
    const bggSecrets = new iam.PolicyStatement();
    bggSecrets.addActions("secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret");
    bggSecrets.addResources(`arn:aws:secretsmanager:${stack.region}:${stack.account}:secret:extstats/bgg*`);

    policies[`policy_auth_bgg`] = new iam.PolicyDocument({
      statements: [bggParameters, bggSecrets]
    });
    return new iam.Role(stack, `role_auth`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: LAMBDA_POLICIES,
    });
  }

  defineAuthLambda(stack: cdk.Stack, role: iam.Role): lambda.Function {
    const fProps: lambda.FunctionProps = {
      functionName: "downloader_auth_thread",
      runtime: RUNTIME,
      handler: "auththread.handler",
      role: role,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET, COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
    };
    const f = new lambda.Function(stack, "downloader_auth_thread", fProps);
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  defineAuthSchedule(stack: cdk.Stack, machine: sfn.IStateMachine): scheduler.Schedule {
    const st1 = new iam.PolicyStatement();
    st1.addActions("states:StartExecution");
    st1.addResources(machine.stateMachineArn);
    const policies: Record<string, iam.PolicyDocument> = {
      "policy_invoke_auth_thread": new iam.PolicyDocument({
        statements: [st1]
      })
    };
    const role = new iam.Role(stack, 'assumeAuthRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    return new scheduler.Schedule(stack, `authSchedule`, {
      schedule: events.Schedule.cron({ minute: '0' }),
      target: new targets.StepFunctionsStartExecution(machine, { role }),
      description: "Every hour, check the BGG auth thread."
    });
  }

  defineAuthStateMachine(stack: cdk.Stack, threadFunc: lambda.Function): sfn.StateMachine {
    const authLogs = new logs.LogGroup(stack, "AuthStateMachineLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    return new sfn.StateMachine(stack, 'authStateMachine2', {
      stateMachineName: "authStateMachineExpress2",
      stateMachineType: sfn.StateMachineType.EXPRESS,
      timeout: Duration.minutes(5),
      logs: {
        destination: authLogs,
        level: sfn.LogLevel.ERROR,
        includeExecutionData: true,
      },
      definitionBody: sfn.DefinitionBody.fromChainable(
          new tasks.LambdaInvoke(stack, "threadTask", {
            lambdaFunction: threadFunc,
          }).next(
              new tasks.LambdaInvoke(stack, "confirmTask", {
                lambdaFunction: CONFIRM_LAMBDA,
              }).next(
                  new sfn.Succeed(stack, "Thread processed")
              )
          )
      ),
    });
  }
}

// daily tasks
class DailyConstruct extends Construct {
  constructor(stack: cdk.Stack, outputQueueArn: string) {
    super(stack, "dailyConstruct");
    const role = this.defineDailyRole(stack, "downloader_daily", outputQueueArn);
    const dailyFunction = this.defineDailyLambda(stack, "downloader_daily", "daily.dailyTasks", role);
    this.defineScheduleToInvokeDaily(dailyFunction);
  }

  defineDailyLambda(stack: cdk.Stack, name: string, handler: string, role: iam.Role): lambda.Function {
    const fProps: lambda.FunctionProps = {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET, COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
      allowPublicSubnet: true
    };
    const f = new lambda.Function(stack, name, fProps);
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  private defineDailyRole(stack: cdk.Stack, name: string, outputQueueArn: string): iam.Role {
    const policies: Record<string, iam.PolicyDocument> = {};
    const access = new iam.PolicyStatement();
    access.addActions("sqs:SendMessage");
    access.addResources(outputQueueArn);
    policies[`policy_${name}_dlq`] = new iam.PolicyDocument({
      statements: [access]
    });
    const parameters = new iam.PolicyStatement();
    parameters.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters", "ssm:PutParameter");
    parameters.addResources(`arn:aws:ssm:${stack.region}:${stack.account}:parameter/extstats/*`);
    policies[`policy_${name}_ssm`] = new iam.PolicyDocument({
      statements: [parameters]
    });
    return new iam.Role(this, `role_${name}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: LAMBDA_POLICIES,
    });
  }

  defineScheduleToInvokeDaily(func: lambda.Function): scheduler.Schedule {
    const role = new iam.Role(this, 'assumeDailyRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    return new scheduler.Schedule(this, `schedule_daily`, {
      schedule: scheduler.ScheduleExpression.rate(Duration.hours(24)),
      description: "Once per day run daily tasks, e.g. rebuild materialised views.",
      target: new targets.LambdaInvoke(func, { role })
    });
  }
}

class MetricsConstruct extends Construct {
  constructor(stack: cdk.Stack) {
    super(stack, "metricsConstruct");
    const countRole = this.defineCountRole("downloader_counts");
    const countFunction = this.defineCountLambda(stack, "downloader_counts", "counts.handler", countRole);
    const cwRole = this.defineCloudwatchRole("downloader_cw");
    const cwFunction = this.defineCloudwatchLambda(stack, "downloader_cw", "cloudwatch.handler", cwRole);
    const sm2 = this.defineCountsStateMachine(stack, cwFunction, countFunction);
    this.defineScheduleToInvokeCounts(sm2);
  }

  private defineCloudwatchRole(name: string): iam.Role {
    const policies: Record<string, iam.PolicyDocument> = {};
    const cwPolicy = new iam.PolicyStatement();
    cwPolicy.addActions("cloudwatch:ListEntitiesForMetric", "cloudwatch:GetMetricData", "cloudwatch:GetMetricStatistics",
        "cloudwatch:GetMetricStream", "cloudwatch:ListMetricStreams", "cloudwatch:ListMetrics");
    cwPolicy.addResources("*");
    policies[`policy_${name}_cw`] = new iam.PolicyDocument({ statements: [cwPolicy] });
    const s3Policy = new iam.PolicyStatement();
    s3Policy.addActions("s3:ListAllMyBuckets");
    s3Policy.addResources("*");
    policies[`policy_${name}_s3`] = new iam.PolicyDocument({ statements: [s3Policy] });
    return new iam.Role(this, `role_${name}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: LAMBDA_POLICIES,
    });
  }

  defineCloudwatchLambda(stack: cdk.Stack, name: string, handler: string, role: iam.Role): lambda.Function {
    const fProps: lambda.FunctionProps = {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET, COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
      allowPublicSubnet: true
    };
    const f = new lambda.Function(stack, name, fProps);
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  defineCountRole(name: string): iam.Role {
    const policies: Record<string, iam.PolicyDocument> = {};
    policies[`policy_${name}_dynamo`] = ACCESS_DYNAMO;
    return new iam.Role(this, `role_${name}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: LAMBDA_POLICIES_WITH_DATABASE,
    });
  }

  defineCountLambda(stack: cdk.Stack, name: string, handler: string, role: iam.Role): lambda.Function {
    const fProps: lambda.FunctionProps = {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET, COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
      allowPublicSubnet: true,
      vpc: DATABASE_VPC,
      vpcSubnets: {
        subnets: [ PRIVATE_SUBNET_A, PRIVATE_SUBNET_B, PRIVATE_SUBNET_C ]
      },
      environment: {}
    };
    fProps.environment.MYSQL_HOST = process.env.MYSQL_HOST;
    fProps.environment.MYSQL_USERNAME = process.env.MYSQL_USERNAME;
    fProps.environment.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD;
    fProps.environment.MYSQL_DATABASE = process.env.MYSQL_DATABASE;
    const f = new lambda.Function(stack, name, fProps);
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  defineCountsStateMachine(stack: cdk.Stack, cwFunction: lambda.Function, countFunction: lambda.Function) {
    const countsLogs = new logs.LogGroup(this, "CountsStateMachineLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    return new sfn.StateMachine(stack, 'countsStateMachine2', {
      stateMachineName: "countsStateMachineExpress2",
      stateMachineType: sfn.StateMachineType.EXPRESS,
      timeout: Duration.minutes(5),
      logs: {
        destination: countsLogs,
        level: sfn.LogLevel.ERROR,
        includeExecutionData: true,
      },
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

  defineScheduleToInvokeCounts(machine: sfn.IStateMachine): scheduler.Schedule {
    const st1 = new iam.PolicyStatement();
    st1.addActions("states:StartExecution");
    st1.addResources(machine.stateMachineArn);
    const policies: Record<string, iam.PolicyDocument> = {
      "policy_invoke_counts_thread": new iam.PolicyDocument({
        statements: [st1]
      })
    };
    const role = new iam.Role(this, 'assumeCountsRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    return new scheduler.Schedule(this, `countsSchedule`, {
      schedule: events.Schedule.rate(Duration.minutes(10)),
      target: new targets.StepFunctionsStartExecution(machine, { role }),
      description: "Every 10 minutes get data from CloudWatch and store it as observability metrics."
    });
  }
}

class NetworkingConstruct extends Construct {
  constructor(stack: cdk.Stack) {
    super(stack, "networkingConstruct");
    const eigw = new ec2.CfnEgressOnlyInternetGateway(stack, 'EgressOnlyIgw', { vpcId: DATABASE_VPC.vpcId });

    // Dedicated route table for the Lambda subnets.
    // No 0.0.0.0/0 route: Lambda ENIs have no public IPv4 address, so the IGW route cannot carry their traffic.
    const routeTable = new ec2.CfnRouteTable(stack, 'LambdaRouteTable', {
      vpcId: DATABASE_VPC.vpcId,
      tags: [{ key: 'Name', value: 'lambda-private-rt' }],
    });
    new ec2.CfnRoute(this, 'Ipv6EgressRoute', {
      routeTableId: routeTable.ref,
      destinationIpv6CidrBlock: '::/0',
      egressOnlyInternetGatewayId: eigw.ref,
    });

    for (const s of [{...PRIVATE_SUBNET_A, name: "A"}, {...PRIVATE_SUBNET_B, name: "B"}, {...PRIVATE_SUBNET_C, name: "C"}]) {
      new ec2.CfnSubnetRouteTableAssociation(this, `RtAssoc-${s.name}`, {
        subnetId: s.subnetId,
        routeTableId: routeTable.ref,
      });
    }

    new ec2.CfnVPCEndpoint(this, "DynamoDbGatewayEndpoint", {
      vpcId: DATABASE_VPC.vpcId,
      serviceName: `com.amazonaws.${stack.region}.dynamodb`,
      vpcEndpointType: "Gateway",
      routeTableIds: [routeTable.ref],
    });
  }
}

// websock messaging
class MessageConstruct extends Construct {
  public messageQueue: sqs.IQueue;

  constructor(stack: cdk.Stack) {
    super(stack, "messageConstruct");
    this.messageQueue = this.defineMessageQueue(stack);
    let role = this.defineMessageRole(stack, "downloader_message");
    let messageLambda: lambda.IFunction = this.defineMessageLambda(stack, "downloader_message", "message.handler", role);
    const mapping = new sources.SqsEventSource(this.messageQueue, {batchSize: 10, enabled: true, maxBatchingWindow: Duration.seconds(3) });
    messageLambda.addEventSource(mapping);
  }

  private defineMessageRole(stack: cdk.Stack, name: string): iam.Role {
    const policies: Record<string, iam.PolicyDocument> = {};
    const parameters1 = new iam.PolicyStatement();
    parameters1.addActions("execute-api:ManageConnections");
    parameters1.addResources(`arn:aws:execute-api:${stack.region}:${stack.account}:*`);
    policies[`policy_${name}_exa`] = new iam.PolicyDocument({
      statements: [parameters1]
    });
    const parameters2 = new iam.PolicyStatement();
    parameters2.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters", "ssm:PutParameter");
    parameters2.addResources(`arn:aws:ssm:${stack.region}:${stack.account}:parameter/extstats/*`);
    policies[`policy_${name}_ssm`] = new iam.PolicyDocument({
      statements: [parameters2]
    });
    policies[`policy_${name}_dynamo`] = ACCESS_DYNAMO;
    return new iam.Role(this, `role_${name}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: LAMBDA_POLICIES,
    });
  }

  defineMessageLambda(stack: cdk.Stack, name: string, handler: string, role: iam.Role): lambda.Function {
    const fProps: lambda.FunctionProps = {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET, COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
      allowPublicSubnet: true,
      reservedConcurrentExecutions: 1
    };
    const f = new lambda.Function(stack, name, fProps);
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  defineMessageQueue(stack: cdk.Stack): sqs.Queue {
    return new sqs.Queue(stack, "messageQueue", {
      queueName: "WebsockMessageQueue",
      visibilityTimeout: Duration.seconds(120)
    });
  }


}

export class DownloadStack extends cdk.Stack {
  lookupExternalResources() {
    // resources external to this stack
    ZIP_BUCKET = s3.Bucket.fromBucketName(this, "bucket", DEPLOYMENT_BUCKET);
    DATABASE_VPC = ec2.Vpc.fromLookup(this, "vpc", {vpcId: process.env.VPC_ID});
    PRIVATE_SUBNET_A = ec2.Subnet.fromSubnetId(this, "private a", process.env.PRIVATE_A || "bug1");
    PRIVATE_SUBNET_B = ec2.Subnet.fromSubnetId(this, "private b", process.env.PRIVATE_B || "bug2");
    PRIVATE_SUBNET_C = ec2.Subnet.fromSubnetId(this, "private c", process.env.PRIVATE_C || "bug3");
    CONFIRM_LAMBDA = lambda.Function.fromFunctionName(this, "confirmFunc", "auth_confirm");
  }

  lookupManagedPolicies() {
    LAMBDA_POLICIES = [
      iam.ManagedPolicy.fromManagedPolicyName(this, "createEC2s", "CreateEC2sForLambda"),
      iam.ManagedPolicy.fromManagedPolicyName(this, "writeLogs", "WriteToCloudwatchLogs"),
    ];
    LAMBDA_POLICIES_WITH_DATABASE = [
      ...LAMBDA_POLICIES,
      iam.ManagedPolicy.fromManagedPolicyName(this, "dbSecrets", "AccessDatabaseSecrets")
    ];
  }

  defineCacheBucket(name: string): s3.Bucket {
    return new s3.Bucket(this, "cacheBucket", {
      bucketName: name,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
  }

  defineLambda(name: string, handler: string, role: iam.IRole, duration: number, mem: number = 128,
               maxConcurrency: number | undefined, durableConfig: { executionTimeout: Duration } | undefined): lambda.Function {
    const code = lambda.Code.fromBucketV2(ZIP_BUCKET, COMPONENT + ".zip");
    const dc = durableConfig ? { durableConfig } : {};
    let opts: lambda.FunctionProps = {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: code,
      timeout: Duration.seconds(duration),
      reservedConcurrentExecutions: maxConcurrency,
      memorySize: mem,
      ...dc
    }
    const f = new lambda.Function(this, name, opts);
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  defineInsideLambda(name: string, handler: string, role: iam.IRole, duration: number, mem: number = 128,
                     maxConcurrency: number | undefined, durableConfig: { executionTimeout: Duration } | undefined,
                     insideLambdaSg: ec2.ISecurityGroup): lambda.Function {
    const code = lambda.Code.fromBucketV2(ZIP_BUCKET, COMPONENT + ".zip");
    const dc = durableConfig ? { durableConfig } : {};
    const vpcOpts: Partial<lambda.FunctionProps> = {
      vpc: DATABASE_VPC,
      vpcSubnets: {
        subnets: [ PRIVATE_SUBNET_A, PRIVATE_SUBNET_B, PRIVATE_SUBNET_C ]
      },
      securityGroups: [ insideLambdaSg ],
      allowPublicSubnet: true
    };
    let opts: lambda.FunctionProps = {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: code,
      timeout: Duration.seconds(duration),
      reservedConcurrentExecutions: maxConcurrency,
      memorySize: mem,
      ...dc,
      ...vpcOpts,
      environment: {
        MYSQL_HOST: process.env.MYSQL_HOST,
        MYSQL_USERNAME: process.env.MYSQL_USERNAME,
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
        MYSQL_DATABASE: process.env.MYSQL_DATABASE
      },
      ipv6AllowedForDualStack: true
    }
    const f = new lambda.Function(this, name, opts);
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  defineSnsTopic(name: string, email: string) {
    const topic = new sns.Topic(this, "downloader_topic", {
      topicName: name,
      fifo: false
    });
    const sub = new sns.Subscription(this, "downloader_topic_sub", {
      topic: topic,
      protocol: sns.SubscriptionProtocol.EMAIL,
      endpoint: email
    });
    Tags.of(sub).add("component", COMPONENT);
    Tags.of(topic).add("component", COMPONENT);
    return topic;
  }

  defineInsideRole(stack: cdk.Stack, messageQueue: sqs.IQueue, retryQueue: sqs.IQueue, outputQueue: sqs.IQueue): iam.IRole {
    const policies: Record<string, iam.PolicyDocument> = {};

    const rdsConnect = new iam.PolicyStatement({
      actions: ["rds-db:connect"],
      resources: [
        `arn:aws:rds-db:${stack.region}:${stack.account}:dbuser:${process.env.DBI_RESOURCE_ID}/extstats_iam`,
      ],
    });
    policies[`policy_rds_db`] = new iam.PolicyDocument({ statements: [rdsConnect] });

    const sendToBGGQueue = new iam.PolicyStatement();
    sendToBGGQueue.addActions("sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes");
    sendToBGGQueue.addResources(messageQueue.queueArn, retryQueue.queueArn, outputQueue.queueArn);
    const sqsList = new iam.PolicyStatement();
    sqsList.addActions("sqs:ListQueues");
    sqsList.addResources("*");
    policies[`policy_inside_queue`] = new iam.PolicyDocument({
      statements: [sendToBGGQueue, sqsList]
    });

    const managedPolicies: iam.IManagedPolicy[] = [
      iam.ManagedPolicy.fromManagedPolicyName(this, "createEC2s_inside", "CreateEC2sForLambda"),
      iam.ManagedPolicy.fromManagedPolicyName(this, "writeLogs_inside", "WriteToCloudwatchLogs"),
    ];

    return new iam.Role(this, `role_inside`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: managedPolicies,
    });
  }

  defineDownloaderRole(stack: cdk.Stack, outputFifoQueue: sqs.IQueue, inputQueue: sqs.IQueue, dlq: sqs.IQueue,
                       cacheBucket: s3.Bucket, topic: sns.Topic): iam.IRole {
    const policies: Record<string, iam.PolicyDocument> = {};
    const bggParameters = new iam.PolicyStatement();
    bggParameters.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters", "ssm:PutParameter");
    bggParameters.addResources(`arn:aws:ssm:${stack.region}:${stack.account}:parameter/extstats/downloader*`);
    const bggSecrets = new iam.PolicyStatement();
    bggSecrets.addActions("secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret");
    bggSecrets.addResources(`arn:aws:secretsmanager:${stack.region}:${stack.account}:secret:extstats/bgg*`);

    policies[`policy_downloader_bgg`] = new iam.PolicyDocument({
      statements: [bggParameters, bggSecrets]
    });

    const loggingParameters = new iam.PolicyStatement();
    loggingParameters.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters");
    loggingParameters.addResources(`arn:aws:ssm:${stack.region}:${stack.account}:parameter/extstats/systemLogGroup*`);
    const loggingCloudWatch = new iam.PolicyStatement();
    loggingCloudWatch.addActions("logs:PutLogEvents", "logs:CreateLogStream", "logs:CreateLogGroup");
    loggingCloudWatch.addResources("*");

    policies[`policy_downloader_logging`] = new iam.PolicyDocument({
      statements: [loggingParameters, loggingCloudWatch]
    });

    const sqsStuff = new iam.PolicyStatement();
    sqsStuff.addActions("sqs:ListQueues");
    sqsStuff.addResources("*");
    policies[`policy_sqs_stuff`] = new iam.PolicyDocument({
      statements: [sqsStuff]
    });

    const sendToBGGQueue = new iam.PolicyStatement();
    sendToBGGQueue.addActions("sqs:SendMessage");
    sendToBGGQueue.addResources(inputQueue.queueArn, outputFifoQueue.queueArn, dlq.queueArn);
    policies[`policy_bgg_queue`] = new iam.PolicyDocument({
      statements: [sendToBGGQueue]
    });

    const sendToSNS = new iam.PolicyStatement();
    sendToSNS.addActions("sns:Publish");
    sendToSNS.addResources(topic.topicArn);
    policies[`policy_downloader_sns`] = new iam.PolicyDocument({
      statements: [sendToSNS]
    });

    const durableLambda = new iam.PolicyStatement();
    durableLambda.addActions("lambda:CheckpointDurableExecution", "lambda:SendDurableExecutionCallbackSuccess", "lambda:SendDurableExecutionCallbackFailure");
    durableLambda.addResources("*");
    policies[`policy_downloader_durable`] = new iam.PolicyDocument({
      statements: [durableLambda]
    });
    const invoke = new iam.PolicyStatement();
    invoke.addActions("lambda:InvokeFunction");
    invoke.addResources(`arn:aws:lambda:${stack.region}:${stack.account}:function:downloader_*`);
    policies[`policy_invoke`] = new iam.PolicyDocument({
      statements: [invoke]
    });

    const useCacheBucket1 = new iam.PolicyStatement();
    useCacheBucket1.addActions("s3:ListBucket");
    useCacheBucket1.addResources(cacheBucket.bucketArn);
    const useCacheBucket2 = new iam.PolicyStatement();
    useCacheBucket2.addActions("s3:*Object");
    useCacheBucket2.addResources(cacheBucket.bucketArn + "/*");
    policies[`policy_cache_bucket`] = new iam.PolicyDocument({
      statements: [useCacheBucket1, useCacheBucket2]
    });
    return new iam.Role(this, `role_downloader`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: LAMBDA_POLICIES,
    });
  }

  defineOutputQueueFifo(): sqs.IQueue {
    return new sqs.Queue(this, "outputQueueFifo", {
      queueName: "downloaderOutputQueue.fifo",
      visibilityTimeout: Duration.seconds(1800),
      redriveAllowPolicy: {
        redrivePermission: sqs.RedrivePermission.ALLOW_ALL,
      },
      fifo: true,
      contentBasedDeduplication: true
    });
  }

  defineDeadLetterQueue(): sqs.IQueue {
    return new sqs.Queue(this, "bggDLQ", {
      queueName: "downloaderDLQ.fifo",
      visibilityTimeout: Duration.seconds(1800),
      redriveAllowPolicy: {
        redrivePermission: sqs.RedrivePermission.ALLOW_ALL,
      },
      fifo: true
    });
  }

  defineInputQueue2(dlq: sqs.DeadLetterQueue): sqs.IQueue {
    return new sqs.Queue(this, "bggQueueNewArch2", {
      queueName: "downloaderInputQueue.fifo",
      visibilityTimeout: Duration.seconds(600),
      deadLetterQueue: dlq,
      contentBasedDeduplication: true,
      fifo: true
    });
  }

  defineRetryQueue(): sqs.IQueue {
    return new sqs.Queue(this, "retryQueue", {
      queueName: "downloaderRetryQueue",
      visibilityTimeout: Duration.seconds(120),
    });
  }

  defineRuleToStartTasksPipeline(machine: sfn.IStateMachine): void {
    const schedulerRole = new iam.Role(this, "StartTasksSchedulerRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions: ["states:StartExecution"],
      resources: [machine.stateMachineArn],
    }));

    new scheduler.Schedule(this, "StartTasksSchedule", {
      schedule: events.Schedule.cron({ minute: '*' }),
      target: new targets.StepFunctionsStartExecution(machine, { role: schedulerRole }),
      description: "Start downloader tasks every minute"
    });
  }

  defineRuleToUpdateMetadata(func: lambda.IFunction): events.Rule {
    const st1 = new iam.PolicyStatement();
    st1.addActions("lambda:InvokeFunction");
    st1.addResources(func.functionArn);
    const policies: Record<string, iam.PolicyDocument> = {
      "policy_invoke_update_metadata": new iam.PolicyDocument({
        statements: [st1]
      })
    };
    const ruleRole = new iam.Role(this, "role_invoke_update_metadata", {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: policies,
    });

    return new events.Rule(this, `updateMetadataRule`, {
      schedule: events.Schedule.cron({ hour: '19', minute: '0' }),
      targets: [ new etargets.LambdaFunction(func) ],
      role: ruleRole
    });
  }

  defineRuleToUpdateUserList(func: lambda.IFunction): events.Rule {
    const st1 = new iam.PolicyStatement();
    st1.addActions("lambda:InvokeFunction");
    st1.addResources(func.functionArn);
    const policies: Record<string, iam.PolicyDocument> = {
      "policy_invoke_update_userlist": new iam.PolicyDocument({
        statements: [st1]
      })
    };
    const ruleRole = new iam.Role(this, "role_invoke_update_userlist", {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: policies,
    });

    return new events.Rule(this, `updateUserListRule`, {
      schedule: events.Schedule.cron({ hour: '7', minute: '0' }),
      targets: [ new etargets.LambdaFunction(func) ],
      role: ruleRole
    });
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.lookupExternalResources();
    this.lookupManagedPolicies();

    const cacheBucket = this.defineCacheBucket(CACHE_BUCKET);
    const outputQueueFifo = this.defineOutputQueueFifo();
    const retryQueue = this.defineRetryQueue();
    const dlq = this.defineDeadLetterQueue();
    const inputQueue = this.defineInputQueue2({ maxReceiveCount: 3, queue: dlq });
    const snsTopic = this.defineSnsTopic(process.env.SNS_TOPIC, process.env.SNS_EMAIL);

    const networkingConstruct = new NetworkingConstruct(this);
    const messageConstruct = new MessageConstruct(this);
    const authConstruct = new AuthConstruct(this);
    const dailyConstruct = new DailyConstruct(this, outputQueueFifo.queueArn);
    const metricsConstruct = new MetricsConstruct(this);

    const role = this.defineDownloaderRole(this, outputQueueFifo, inputQueue, dlq, cacheBucket, snsTopic);
    let userListLambda: lambda.IFunction = undefined;
    let metadataLambda: lambda.IFunction = undefined;
    let preLambda: lambda.IFunction = undefined;
    for (const spec of LAMBDA_SPECS) {
      const f = this.defineLambda(spec.name, spec.handler, role, spec.duration, spec.mem, spec.maxConcurrency, spec.durableConfig);
      if (spec.name.endsWith("_processUserList")) {
        userListLambda = f;
      } else if (spec.name.endsWith("_processMetadata")) {
        metadataLambda = f;
      } else if (spec.name.endsWith("_prehandle")) {
        preLambda = f;
      }
    }
    const insideLambdaSg: ec2.ISecurityGroup = new ec2.SecurityGroup(this, "InsideLambdaSg", {
      vpc: DATABASE_VPC,
      description: "Inside Lambdas: MySQL only",
      allowAllOutbound: true,
    });
    const insideRole = this.defineInsideRole(this, messageConstruct.messageQueue, retryQueue, outputQueueFifo);
    let startTasksLambda: lambda.IFunction = undefined;
    let writeLambda: lambda.IFunction = undefined;
    for (const spec of INSIDE_LAMBDA_SPECS) {
      const f = this.defineInsideLambda(spec.name, spec.handler, insideRole, spec.duration, spec.mem, spec.maxConcurrency, spec.durableConfig, insideLambdaSg);
      if (spec.name.endsWith("StartTasks")) {
        startTasksLambda = f;
      } else if (spec.name.endsWith("WriteResults")) {
        writeLambda = f;
      }
    }
    if (writeLambda) {
      const mapping = new sources.SqsEventSource(outputQueueFifo, {batchSize: 10, enabled: true });
      writeLambda.addEventSource(mapping);
    } else {
      console.log("There isn't any write lambda");
    }
    if (userListLambda) {
      this.defineRuleToUpdateUserList(userListLambda);
    } else {
      console.log("There isn't any user list lambda");
    }
    if (metadataLambda) {
      this.defineRuleToUpdateMetadata(metadataLambda);
    } else {
      console.log("There isn't any metadata lambda");
    }
    if (startTasksLambda && preLambda) {
      const startTasksStep = new tasks.LambdaInvoke(this, "InsideStartTasks", {
        lambdaFunction: startTasksLambda,
        payloadResponseOnly: true,
      });
      const prehandleStep = new tasks.LambdaInvoke(this, "Prehandle", {
        lambdaFunction: preLambda,
        payloadResponseOnly: true,
      });
      const pipelineLogs = new logs.LogGroup(this, "StartTasksPipelineLogs", {
        retention: logs.RetentionDays.ONE_WEEK,
      });

      const startTasksPipeline = new sfn.StateMachine(this, "StartTasksPipeline", {
        stateMachineName: "startDownloaderTasksExpress",
        definitionBody: sfn.DefinitionBody.fromChainable(startTasksStep.next(prehandleStep)),
        stateMachineType: sfn.StateMachineType.EXPRESS,
        timeout: Duration.minutes(5),
        logs: {
          destination: pipelineLogs,
          level: sfn.LogLevel.ERROR,
          includeExecutionData: true,
        },
      });
      this.defineRuleToStartTasksPipeline(startTasksPipeline);

      new cdk.CfnOutput(this, "StartTasksPipelineArn", {
        value: startTasksPipeline.stateMachineArn,
        exportName: "downloader-startTasksPipelineARN",
      });
    } else {
      console.log("Could not connect start tasks to prehandle!!!!");
    }

    // Used by the Rust stack
    new cdk.CfnOutput(this, 'downloaderInputQueueArn', {
      value: inputQueue.queueArn,
      exportName: 'downloader-InputQueueARN'
    });
  }
}
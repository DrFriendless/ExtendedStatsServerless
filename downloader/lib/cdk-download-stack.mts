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

// bgg - access BoardGameGeek, needs to be public
// db - access to the database, needs to be private
// logging - ability to write to CloudWatch logs
// cw - ability to read CloudWatch metrics, needs to be public
// dynamo - access DynamoDB
// single - max concurrency 1
// downloader - access to send to downloader queue
type OptsType = "bgg" | "db" | "logging" | "cw" | "dynamo" | "single" | "sqs" | "ssm" | "message" | "downloader";

let ZIP_BUCKET: s3.IBucket | undefined = undefined;
let DATABASE_VPC: ec2.IVpc = undefined;
let PRIVATE_SUBNET_A: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_B: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_C: ec2.ISubnet = undefined;
let CONFIRM_LAMBDA: lambda.IFunction = undefined;

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
    const authLogs = new logs.LogGroup(this, "AuthStateMachineLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    return new sfn.StateMachine(this, 'authStateMachine2', {
      stateMachineName: "authStateMachineExpress2",
      stateMachineType: sfn.StateMachineType.EXPRESS,
      timeout: Duration.minutes(5),
      logs: {
        destination: authLogs,
        level: sfn.LogLevel.ERROR,
        includeExecutionData: true,
      },
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
    const countsLogs = new logs.LogGroup(this, "CountsStateMachineLogs", {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    return new sfn.StateMachine(this, 'countsStateMachine2', {
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

  private defineComplicatedRole(opts: OptsType[], name: string, n: number, accessDynamo: iam.PolicyDocument, downloaderQueueFifo: string): iam.Role {
    const policies: Record<string, iam.PolicyDocument> = {};
    if (opts.indexOf("downloader") >= 0) {
      const access = new iam.PolicyStatement();
      access.addActions("sqs:SendMessage");
      access.addResources(downloaderQueueFifo);
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
      policies[`policy_${name}_dynamo`] = accessDynamo;
    }
    return new iam.Role(this, `role_${name}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: this.definePolicies(opts, n),
    });
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


  /**
   *
   * @param name
   * @param handler
   * @param opts
   * @param subnetType - public means outside VPC, private means private subnet inside VPC.
   * @param n - a unique number for every function, used to generate unique names
   * @param accessDynamo
   * @param downloaderQueueFifo
   */
  defineLambdaComplicated(name: string, handler: string, opts: OptsType[], subnetType: "public" | "private", n: number,
                          accessDynamo: iam.PolicyDocument, downloaderQueueFifo: string): lambda.Function {
    const role = this.defineComplicatedRole(opts, name, n, accessDynamo, downloaderQueueFifo);
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

  defineInsideRole(messageQueue: sqs.IQueue, retryQueue: sqs.IQueue, outputQueue: sqs.IQueue): iam.IRole {
    const policies: Record<string, iam.PolicyDocument> = {};

    const rdsConnect = new iam.PolicyStatement({
      actions: ["rds-db:connect"],
      resources: [
        `arn:aws:rds-db:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:dbuser:${process.env.DBI_RESOURCE_ID}/extstats_iam`,
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

  defineDownloaderRole(outputFifoQueue: sqs.IQueue, inputQueue: sqs.IQueue, dlq: sqs.IQueue,
                       cacheBucket: s3.Bucket, topic: sns.Topic): iam.IRole {
    const policies: Record<string, iam.PolicyDocument> = {};
    const bggParameters = new iam.PolicyStatement();
    bggParameters.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters", "ssm:PutParameter");
    bggParameters.addResources(`arn:aws:ssm:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:parameter/extstats/downloader*`);
    const bggSecrets = new iam.PolicyStatement();
    bggSecrets.addActions("secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret");
    bggSecrets.addResources(`arn:aws:secretsmanager:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:secret:extstats/bgg*`);

    policies[`policy_downloader_bgg`] = new iam.PolicyDocument({
      statements: [bggParameters, bggSecrets]
    });

    const loggingParameters = new iam.PolicyStatement();
    loggingParameters.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters");
    loggingParameters.addResources(`arn:aws:ssm:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:parameter/extstats/systemLogGroup*`);
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
    invoke.addResources(`arn:aws:lambda:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:function:downloader_*`);
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

    const managedPolicies: iam.IManagedPolicy[] = [
      iam.ManagedPolicy.fromManagedPolicyName(this, "createEC2s", "CreateEC2sForLambda"),
      iam.ManagedPolicy.fromManagedPolicyName(this, "writeLogs", "WriteToCloudwatchLogs"),
    ];

    return new iam.Role(this, `role_downloader`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: managedPolicies,
    });
  }



  defineOutputQueue(): sqs.IQueue {
    return new sqs.Queue(this, "outputQueue", {
      queueName: "downloaderOutputQueue",
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

  defineMessageQueue(): sqs.Queue {
    return new sqs.Queue(this, "messageQueue", {
      queueName: "WebsockMessageQueue",
      visibilityTimeout: Duration.seconds(120)
    });
  }

  definePlaysQueue(): sqs.IQueue {
    return new sqs.Queue(this, "playsQueue", {
      queueName: "downloaderPlaysQueue",
      visibilityTimeout: Duration.seconds(900),
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

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.lookupExternalResources();

    const accessDynamo = this.defineAccessDynamoPolicy();
    const cacheBucket = this.defineCacheBucket(CACHE_BUCKET);
    const outputQueue = this.defineOutputQueue();
    const outputQueueFifo = this.defineOutputQueueFifo();
    const playsQueue = this.definePlaysQueue();
    const retryQueue = this.defineRetryQueue();
    const dlq = this.defineDeadLetterQueue();
    const inputQueue = this.defineInputQueue2({ maxReceiveCount: 3, queue: dlq });
    const snsTopic = this.defineSnsTopic(process.env.SNS_TOPIC, process.env.SNS_EMAIL);
    const eigw = new ec2.CfnEgressOnlyInternetGateway(this, 'EgressOnlyIgw', { vpcId: DATABASE_VPC.vpcId });
    const messageQueue = this.defineMessageQueue();

    // Dedicated route table for the Lambda subnets.
    // No 0.0.0.0/0 route: Lambda ENIs have no public IPv4 address, so the IGW route cannot carry their traffic.
    const routeTable = new ec2.CfnRouteTable(this, 'LambdaRouteTable', {
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

    const role = this.defineDownloaderRole(outputQueueFifo, inputQueue, dlq, cacheBucket, snsTopic);
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
    const insideRole = this.defineInsideRole(messageQueue, retryQueue, outputQueueFifo);
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
      const mapping = new sources.SqsEventSource(outputQueueFifo, {batchSize: 10, enabled: false });
      writeLambda.addEventSource(mapping);
      new cdk.CfnOutput(this, 'downloaderWriteMapping', {
        value: mapping.eventSourceMappingId,
        exportName: 'downloader-WriteMappingUUID'
      });
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

    const threadFunction = this.defineLambdaComplicated("downloader_auth_thread", "auththread.handler", ["bgg"], "public", 1, accessDynamo, outputQueueFifo.queueArn);
    const sm = this.defineAuthStateMachine(threadFunction);
    const rule = this.defineScheduleToInvokeAuth(sm, 1);
    const countFunction = this.defineLambdaComplicated("downloader_counts", "counts.handler", ["db","dynamo"], "private", 4, accessDynamo, outputQueueFifo.queueArn);
    const cwFunction = this.defineLambdaComplicated("downloader_cw", "cloudwatch.handler", ["cw"], "public", 5, accessDynamo, outputQueueFifo.queueArn);
    const sm2 = this.defineCountsStateMachine(cwFunction, countFunction);
    const rule6 = this.defineScheduleToInvokeCounts(sm2, 6);
    const dailyFunction = this.defineLambdaComplicated("downloader_daily", "daily.dailyTasks", ["ssm", "downloader"], "public", 8, accessDynamo, outputQueueFifo.queueArn);
    // schedules are the new way to do rules
    const dailySchedule = this.defineScheduleToInvokeDaily(dailyFunction, 9);

    let messageLambda: lambda.IFunction = this.defineLambdaComplicated("downloader_message", "message.handler", ["dynamo","single","sqs","ssm","message"], "public", 7, accessDynamo, outputQueueFifo.queueArn);
    if (messageLambda) {
      const mapping = new sources.SqsEventSource(messageQueue, {batchSize: 10, enabled: false, maxBatchingWindow: Duration.seconds(3) });
      messageLambda.addEventSource(mapping);
      new cdk.CfnOutput(this, 'messageMapping', {
        value: mapping.eventSourceMappingId,
        exportName: 'downloader-MessageMappingUUID'
      });
    } else {
      console.log("There isn't any message lambda");
    }

    new cdk.CfnOutput(this, 'MessageQueue', {
      value: messageQueue.queueUrl,
      exportName: 'downloader-MessageQueueURL'
    });
    new cdk.CfnOutput(this, 'MessageQueueARN', {
      value: messageQueue.queueArn,
      exportName: 'downloader-MessageQueueARN'
    });
    new cdk.CfnOutput(this, 'downloaderOutputQueue', {
      value: outputQueue.queueUrl,
      exportName: 'downloader-OutputQueueURL'
    });
    new cdk.CfnOutput(this, 'downloaderOutputQueueArn', {
      value: outputQueue.queueArn,
      exportName: 'downloader-OutputQueueARN'
    });
    new cdk.CfnOutput(this, 'downloaderOutputFifoQueue', {
      value: outputQueueFifo.queueUrl,
      exportName: 'downloader-OutputFifoQueueURL'
    });
    new cdk.CfnOutput(this, 'downloaderOutputFifoQueueArn', {
      value: outputQueueFifo.queueArn,
      exportName: 'downloader-OutputFifoQueueARN'
    });
    new cdk.CfnOutput(this, 'downloaderPlaysQueue', {
      value: playsQueue.queueUrl,
      exportName: 'downloader-PlaysQueueURL'
    });
    new cdk.CfnOutput(this, 'downloaderInputQueue', {
      value: inputQueue.queueUrl,
      exportName: 'downloader-InputQueueURL'
    });
    new cdk.CfnOutput(this, 'downloaderInputQueueArn', {
      value: inputQueue.queueArn,
      exportName: 'downloader-InputQueueARN'
    });
    new cdk.CfnOutput(this, 'downloaderRetryQueue', {
      value: retryQueue.queueUrl,
      exportName: 'downloader-RetryQueueURL'
    });
    new cdk.CfnOutput(this, 'downloaderCache', {
      value: cacheBucket.bucketArn,
      exportName: 'downloader-cacheBucketARN'
    });
    new cdk.CfnOutput(this, 'downloaderTopic', {
      value: snsTopic.topicArn,
      exportName: 'downloader-topicARN'
    });
    new cdk.CfnOutput(this, 'downloaderPrelambda', {
      value: preLambda.functionArn,
      exportName: 'downloader-prehandle'
    });
  }
}
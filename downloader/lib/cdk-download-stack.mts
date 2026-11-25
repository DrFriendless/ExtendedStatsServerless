import * as cdk from 'aws-cdk-lib';
import {Duration, Tags} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sources from "aws-cdk-lib/aws-lambda-event-sources";
import * as ec2 from "aws-cdk-lib/aws-ec2";
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
let ACCESS_DYNAMO: iam.PolicyDocument = undefined;

function defineAccessDynamoPolicy(stack: cdk.Stack): iam.PolicyDocument {
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
      `arn:aws:dynamodb:${stack.region}:${stack.account}:table/websocket_connections`,
      `arn:aws:dynamodb:${stack.region}:${stack.account}:table/geek_connections`
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
    return new scheduler.Schedule(stack, `authSchedule`, {
      schedule: scheduler.ScheduleExpression.cron({ minute: '0' }),
      target: new targets.StepFunctionsStartExecution(machine, {}),
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
    return new scheduler.Schedule(this, `countsSchedule`, {
      schedule: scheduler.ScheduleExpression.rate(Duration.minutes(10)),
      target: new targets.StepFunctionsStartExecution(machine, { }),
      description: "Every 10 minutes get data from CloudWatch and store it as observability metrics."
    });
  }
}

class NetworkingConstruct extends Construct {
  public insideLambdaSg: ec2.ISecurityGroup;

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

    this.insideLambdaSg = new ec2.SecurityGroup(stack, "InsideLambdaSg", {
      vpc: DATABASE_VPC,
      description: "Inside Lambdas use IPv6",
      allowAllOutbound: true,
      allowAllIpv6Outbound: true
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

class DownloaderInsideConstruct extends Construct {
  public startTasksLambda: lambda.IFunction = undefined;

  constructor(stack: cdk.Stack, messageQueue: sqs.IQueue, retryQueue: sqs.IQueue, outputQueue: sqs.IQueue, insideLambdaSg: ec2.ISecurityGroup) {
    super(stack, "downloaderInside");
    const insideRole = this.defineInsideRole(stack, messageQueue, retryQueue, outputQueue);
    let writeLambda: lambda.IFunction = undefined;
    for (const spec of INSIDE_LAMBDA_SPECS) {
      const f = this.defineInsideLambda(stack, spec.name, spec.handler, insideRole, spec.duration, spec.mem, spec.maxConcurrency, spec.durableConfig, insideLambdaSg);
      if (spec.name.endsWith("StartTasks")) {
        this.startTasksLambda = f;
      } else if (spec.name.endsWith("WriteResults")) {
        writeLambda = f;
      }
    }
    if (writeLambda) {
      const mapping = new sources.SqsEventSource(outputQueue, {batchSize: 10, enabled: true });
      writeLambda.addEventSource(mapping);
    } else {
      console.log("There isn't any write lambda");
    }
  }

  defineInsideLambda(stack: cdk.Stack, name: string, handler: string, role: iam.IRole, duration: number, mem: number = 128,
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
        MYSQL_DATABASE: process.env.MYSQL_DATABASE,
        AWS_USE_DUALSTACK_ENDPOINT: "true",
      },
      ipv6AllowedForDualStack: true
    }
    const f = new lambda.Function(stack, name, opts);
    Tags.of(f).add("component", COMPONENT);
    return f;
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

}

class DownloaderOutsideConstruct extends Construct {
  outputQueueFifo: sqs.IQueue = undefined;
  inputQueue: sqs.IQueue = undefined;
  retryQueue: sqs.IQueue = undefined;
  prehandle: lambda.IFunction = undefined;

  constructor(stack: cdk.Stack) {
    super(stack, "downloaderOutside");

    const cacheBucket = this.defineCacheBucket(stack, CACHE_BUCKET);
    this.outputQueueFifo = this.defineOutputQueueFifo(stack);
    this.retryQueue = this.defineRetryQueue(stack);
    const dlq = this.defineDeadLetterQueue(stack);
    this.inputQueue = this.defineInputQueue2(stack, { maxReceiveCount: 3, queue: dlq });
    const snsTopic = this.defineSnsTopic(process.env.SNS_TOPIC, process.env.SNS_EMAIL);
    const role = this.defineDownloaderRole(stack, this.outputQueueFifo, this.inputQueue, dlq, cacheBucket, snsTopic);
    // Lambdas
    let userListLambda: lambda.IFunction = undefined;
    let metadataLambda: lambda.IFunction = undefined;
    for (const spec of LAMBDA_SPECS) {
      const f = this.defineLambda(stack, spec.name, spec.handler, role, spec.duration, spec.mem, spec.maxConcurrency, spec.durableConfig);
      if (spec.name.endsWith("_processUserList")) {
        userListLambda = f;
      } else if (spec.name.endsWith("_processMetadata")) {
        metadataLambda = f;
      } else if (spec.name.endsWith("_prehandle")) {
        this.prehandle = f;
      }
    }
    // schedules
    if (metadataLambda) {
      this.defineScheduleToUpdateMetadata(metadataLambda);
    } else {
      console.log("There isn't any metadata lambda");
    }
    if (userListLambda) {
      this.defineScheduleToUpdateUserList(userListLambda);
    } else {
      console.log("There isn't any user list lambda");
    }
    if (!this.prehandle) {
      console.log("There isn't any user prehandle lambda");
    }
  }

  defineScheduleToUpdateUserList(func: lambda.IFunction): scheduler.Schedule {
    return new scheduler.Schedule(this, `updateUserListSchedule`, {
      schedule: scheduler.ScheduleExpression.cron({ hour: '7', minute: '0' }),
      target: new targets.LambdaInvoke(func),
      description: "Update the user list at 7am UTC"
    });
  }

  defineScheduleToUpdateMetadata(func: lambda.IFunction): scheduler.Schedule {
    return new scheduler.Schedule(this, `updateMetadataSchedule`, {
      schedule: scheduler.ScheduleExpression.cron({ hour: '10', minute: '0' }),
      target: new targets.LambdaInvoke(func),
      description: "Update the metadata at 7pm UTC"
    });
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

  defineOutputQueueFifo(stack: cdk.Stack): sqs.IQueue {
    return new sqs.Queue(stack, "outputQueueFifo", {
      queueName: "downloaderOutputQueue.fifo",
      visibilityTimeout: Duration.seconds(1800),
      redriveAllowPolicy: {
        redrivePermission: sqs.RedrivePermission.ALLOW_ALL,
      },
      fifo: true,
      contentBasedDeduplication: true
    });
  }

  defineDeadLetterQueue(stack: cdk.Stack): sqs.IQueue {
    return new sqs.Queue(stack, "bggDLQ", {
      queueName: "downloaderDLQ.fifo",
      visibilityTimeout: Duration.seconds(1800),
      redriveAllowPolicy: {
        redrivePermission: sqs.RedrivePermission.ALLOW_ALL,
      },
      fifo: true
    });
  }

  defineInputQueue2(stack: cdk.Stack, dlq: sqs.DeadLetterQueue): sqs.IQueue {
    return new sqs.Queue(stack, "bggQueueNewArch2", {
      queueName: "downloaderInputQueue.fifo",
      visibilityTimeout: Duration.seconds(600),
      deadLetterQueue: dlq,
      contentBasedDeduplication: true,
      fifo: true
    });
  }

  defineRetryQueue(stack: cdk.Stack): sqs.IQueue {
    return new sqs.Queue(stack, "retryQueue", {
      queueName: "downloaderRetryQueue",
      visibilityTimeout: Duration.seconds(120),
    });
  }

  defineCacheBucket(stack: cdk.Stack, name: string): s3.Bucket {
    return new s3.Bucket(stack, "cacheBucket", {
      bucketName: name,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
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


  defineLambda(stack: cdk.Stack, name: string, handler: string, role: iam.IRole, duration: number, mem: number = 128,
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
    const f = new lambda.Function(stack, name, opts);
    Tags.of(f).add("component", COMPONENT);
    return f;
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

  defineScheduleToStartTasks(machine: sfn.IStateMachine): void {
    new scheduler.Schedule(this, "StartTasksSchedule", {
      schedule: scheduler.ScheduleExpression.rate(Duration.minutes(1)),
      target: new targets.StepFunctionsStartExecution(machine, { }),
      description: "Start downloader tasks every minute"
    });
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.lookupExternalResources();
    ACCESS_DYNAMO = defineAccessDynamoPolicy(this);
    this.lookupManagedPolicies();

    const downloaderOutside = new DownloaderOutsideConstruct(this);
    const networkingConstruct = new NetworkingConstruct(this);
    const messageConstruct = new MessageConstruct(this);
    const downloaderInside = new DownloaderInsideConstruct(this, messageConstruct.messageQueue, downloaderOutside.retryQueue, downloaderOutside.outputQueueFifo, networkingConstruct.insideLambdaSg);
    const authConstruct = new AuthConstruct(this);
    const dailyConstruct = new DailyConstruct(this, downloaderOutside.outputQueueFifo.queueArn);
    const metricsConstruct = new MetricsConstruct(this);

    // connect startTasks to prehandle.
    if (downloaderInside.startTasksLambda && downloaderOutside.prehandle) {
      const startTasksStep = new tasks.LambdaInvoke(this, "InsideStartTasks", {
        lambdaFunction: downloaderInside.startTasksLambda,
        payloadResponseOnly: true,
      });
      const prehandleStep = new tasks.LambdaInvoke(this, "Prehandle", {
        lambdaFunction: downloaderOutside.prehandle,
        payloadResponseOnly: true,
      });
      const pipelineLogs = new logs.LogGroup(this, "StartTasksPipelineLogs", {
        retention: logs.RetentionDays.ONE_WEEK,
      });

      const startTasksMachine = new sfn.StateMachine(this, "StartTasksPipeline", {
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
      this.defineScheduleToStartTasks(startTasksMachine);
    } else {
      console.log("Could not connect start tasks to prehandle!!!!");
    }

    // Used by the Rust stack
    new cdk.CfnOutput(this, 'downloaderInputQueueArn', {
      value: downloaderOutside.inputQueue.queueArn,
      exportName: 'downloader-InputQueueARN'
    });
  }
}
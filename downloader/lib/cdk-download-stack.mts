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
let MESSAGE_QUEUE: sqs.IQueue = undefined;

export class DownloadStack extends cdk.Stack {
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

  lookupExternalResources() {
    // resources external to this stack
    ZIP_BUCKET = s3.Bucket.fromBucketName(this, "bucket", DEPLOYMENT_BUCKET);
    DATABASE_VPC = ec2.Vpc.fromLookup(this, "vpc", {vpcId: process.env.VPC_ID});
    PRIVATE_SUBNET_A = ec2.Subnet.fromSubnetId(this, "private a", process.env.PRIVATE_A || "bug1");
    PRIVATE_SUBNET_B = ec2.Subnet.fromSubnetId(this, "private b", process.env.PRIVATE_B || "bug2");
    PRIVATE_SUBNET_C = ec2.Subnet.fromSubnetId(this, "private c", process.env.PRIVATE_C || "bug3");
    MESSAGE_QUEUE = sqs.Queue.fromQueueArn(this, "messageQueueDL", cdk.Fn.importValue("misc-MessageQueueARN"));
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

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.lookupExternalResources();

    // Create the egress-only internet gateway.
    const eigw = new ec2.CfnEgressOnlyInternetGateway(this, 'EgressOnlyIgw', {
      vpcId: DATABASE_VPC.vpcId,
    });

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


    const cacheBucket = this.defineCacheBucket(CACHE_BUCKET);
    const outputQueue = this.defineOutputQueue();
    const outputQueueFifo = this.defineOutputQueueFifo();
    const playsQueue = this.definePlaysQueue();
    const retryQueue = this.defineRetryQueue();
    const dlq = this.defineDeadLetterQueue();
    const inputQueue = this.defineInputQueue2({ maxReceiveCount: 3, queue: dlq });

    const snsTopic = this.defineSnsTopic(process.env.SNS_TOPIC, process.env.SNS_EMAIL);
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
    const insideRole = this.defineInsideRole(MESSAGE_QUEUE, retryQueue, outputQueueFifo);
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
      // TODO
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
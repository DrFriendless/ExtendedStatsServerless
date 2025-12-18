import * as cdk from 'aws-cdk-lib';
import {Duration, Tags} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sources from "aws-cdk-lib/aws-lambda-event-sources";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import {COMPONENT, DEPLOYMENT_BUCKET, LAMBDA_SPECS, CACHE_BUCKET} from "./metadata.mts";
import {BlockPublicAccess} from "aws-cdk-lib/aws-s3";
import {Rule} from "aws-cdk-lib/aws-events";

const RUNTIME = lambda.Runtime.NODEJS_22_X;

let ZIP_BUCKET: s3.IBucket | undefined = undefined;

export class DownloadStack extends cdk.Stack {
  defineCacheBucket(name: string): s3.Bucket {
    return new s3.Bucket(this, "cacheBucket", {
      bucketName: name,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });
  }

  defineLambda(name: string, handler: string, role: iam.IRole, duration: number, maxConcurrency: number | undefined): lambda.Function {
    const code = lambda.Code.fromBucketV2(ZIP_BUCKET, COMPONENT + ".zip");
    let opts: lambda.FunctionProps = {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: code,
      timeout: Duration.seconds(duration),
      reservedConcurrentExecutions: maxConcurrency
    }
    const f = new lambda.Function(this, name, opts);
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  defineDownloaderRole(outputQueue: sqs.IQueue, cacheBucket: s3.Bucket): iam.IRole {
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

    const sendToOutputQueue = new iam.PolicyStatement();
    sendToOutputQueue.addActions("sqs:SendMessage");
    sendToOutputQueue.addResources(outputQueue.queueArn);
    policies[`policy_downloader_queue`] = new iam.PolicyDocument({
      statements: [sendToOutputQueue]
    });

    const useCacheBucket = new iam.PolicyStatement();
    useCacheBucket.addActions("s3:PutObject", "s3:DeleteObject", "s3:GetObject", "s3:ListBucket");
    useCacheBucket.addResources(cacheBucket.bucketArn);
    policies[`policy_cache_bucket`] = new iam.PolicyDocument({
      statements: [useCacheBucket]
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
  }

  defineOutputQueue(): sqs.IQueue {
    return new sqs.Queue(this, "outputQueue", {
      queueName: "downloaderOutputQueue",
    });
  }

  definePlaysQueue(): sqs.IQueue {
    return new sqs.Queue(this, "playsQueue", {
      queueName: "downloaderPlaysQueue",
      visibilityTimeout: Duration.seconds(120),
    });
  }

  defineRuleToUpdateUserList(func: lambda.IFunction): Rule {
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
      targets: [ new targets.LambdaFunction(func) ],
      role: ruleRole
    });
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.lookupExternalResources();

    const cacheBucket = this.defineCacheBucket(CACHE_BUCKET);
    const outputQueue = this.defineOutputQueue();
    const playsQueue = this.definePlaysQueue();

    const role = this.defineDownloaderRole(outputQueue, cacheBucket);
    let playsLambda: lambda.IFunction = undefined;
    let userListLambda: lambda.IFunction = undefined;
    for (const spec of LAMBDA_SPECS) {
      const f = this.defineLambda(spec.name, spec.handler, role, spec.duration, spec.maxConcurrency);
      if (spec.name.endsWith("_processPlayed")) {
        playsLambda = f;
      } else if (spec.name.endsWith("_processUserList")) {
        userListLambda = f;
      }
    }
    if (playsLambda) {
      const mapping = new sources.SqsEventSource(playsQueue, {batchSize: 1, enabled: false});
      playsLambda.addEventSource(mapping);
      new cdk.CfnOutput(this, 'downloaderPlaysMapping', {
        value: mapping.eventSourceMappingId,
        exportName: 'downloader-PlaysMappingUUID'
      });
    }
    if (userListLambda) {
      this.defineRuleToUpdateUserList(userListLambda);
    }
    new cdk.CfnOutput(this, 'downloaderOutputQueue', {
      value: outputQueue.queueUrl,
      exportName: 'downloader-OutputQueueURL'
    });
    new cdk.CfnOutput(this, 'downloaderPlaysQueue', {
      value: playsQueue.queueUrl,
      exportName: 'downloader-PlaysQueueURL'
    });
    new cdk.CfnOutput(this, 'downloaderCache', {
      value: cacheBucket.bucketArn,
      exportName: 'downloader-cacheBucketARN'
    });
  }
}
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
import * as targets from "aws-cdk-lib/aws-events-targets";
import {COMPONENT, DEPLOYMENT_BUCKET} from "./metadata.mts";
import {Rule} from "aws-cdk-lib/aws-events";
import {Role} from "aws-cdk-lib/aws-iam";
// import {VpcEndpointIpAddressType} from "aws-cdk-lib/aws-ec2";

let ZIP_BUCKET: s3.IBucket | undefined = undefined;
let DATABASE_VPC: ec2.IVpc = undefined;
let PRIVATE_SUBNET_A: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_B: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_C: ec2.ISubnet = undefined;
let PUBLIC_SUBNET_A: ec2.ISubnet = undefined;
let PUBLIC_SUBNET_B: ec2.ISubnet = undefined;
let PUBLIC_SUBNET_C: ec2.ISubnet = undefined;
let CONFIRM_LAMBDA: lambda.IFunction = undefined;

export const RUNTIME = lambda.Runtime.NODEJS_22_X;
type OptsType = "bgg" | "db" | "logging";

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

  defineReportStateMachine(reportFunc: lambda.Function, writeFunc: lambda.Function): sfn.StateMachine {
    return new sfn.StateMachine(this, 'reportStateMachine', {
      definitionBody: sfn.DefinitionBody.fromChainable(
          new tasks.LambdaInvoke(this, "reportTask", {
            lambdaFunction: reportFunc,
          }).next(
              new tasks.LambdaInvoke(this, "writeTask", {
                lambdaFunction: writeFunc,
              }).next(
                  new sfn.Succeed(this, "Report completed")
              )
          )
      ),
    });
  }

  defineRuleToInvokeAuth(machine: sfn.IStateMachine, n: number): Rule {
    const st1 = new iam.PolicyStatement();
    st1.addActions("states:StartExecution");
    st1.addResources(machine.stateMachineArn);
    const policies: Record<string, iam.PolicyDocument> = {
      "policy_invoke_auth_thread": new iam.PolicyDocument({
        statements: [st1]
      })
    };
    const ruleRole = new iam.Role(this, "role_invoke_auth_thread", {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: policies,
    });
    return new events.Rule(this, `machineRule${n}`, {
      schedule: events.Schedule.cron({ minute: '0' }),
      targets: [ new targets.SfnStateMachine(machine) ],
      role: ruleRole
    });
  }

  defineRuleToInvokeReport(machine: sfn.IStateMachine, n: number): Rule {
    const st1 = new iam.PolicyStatement();
    st1.addActions("states:StartExecution");
    st1.addResources(machine.stateMachineArn);
    const policies: Record<string, iam.PolicyDocument> = {
      "policy_invoke_report": new iam.PolicyDocument({
        statements: [st1]
      })
    };
    const ruleRole = new iam.Role(this, "role_invoke_report", {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
      inlinePolicies: policies,
    });
    return new events.Rule(this, `machineRule${n}`, {
      schedule: events.Schedule.cron({ minute: '30' }),
      targets: [ new targets.SfnStateMachine(machine) ],
      role: ruleRole
    });
  }

  defineLambda(name: string, handler: string, opts: OptsType[], subnetType: "public" | "private", n: number): lambda.Function {
    const role = this.defineRole(opts, name, n);
    const vpcOpts: Partial<lambda.FunctionProps> = {
      vpc: DATABASE_VPC,
      vpcSubnets: {
        subnets: []
      }
    };
    if (subnetType === "public") {
      vpcOpts.vpcSubnets.subnets.push(PUBLIC_SUBNET_A);
      vpcOpts.vpcSubnets.subnets.push(PUBLIC_SUBNET_B);
      vpcOpts.vpcSubnets.subnets.push(PUBLIC_SUBNET_C);
    } else {
      vpcOpts.vpcSubnets.subnets.push(PRIVATE_SUBNET_A);
      vpcOpts.vpcSubnets.subnets.push(PRIVATE_SUBNET_B);
      vpcOpts.vpcSubnets.subnets.push(PRIVATE_SUBNET_C);
    }
    const f = new lambda.Function(this, name, {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET, COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
      allowPublicSubnet: true,
      environment: {
        "opts": JSON.stringify(opts)
      },
      ...(subnetType === "public" ? {} : vpcOpts)
    });
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

  private defineRole(opts: OptsType[], name: string, n: number): Role {
    const policies: Record<string, iam.PolicyDocument> = {};
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
    return new iam.Role(this, `role_${name}`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: this.definePolicies(opts, n),
    });
  }

  lookupExternalResources() {
    // resources external to this stack
    DATABASE_VPC = ec2.Vpc.fromLookup(this, "vpc", {vpcId: "vpc-5c8a7a3b"});
    PRIVATE_SUBNET_A = ec2.Subnet.fromSubnetId(this, "private a", "subnet-f565d0bc");
    PRIVATE_SUBNET_B = ec2.Subnet.fromSubnetId(this, "private b", "subnet-a865decf");
    PRIVATE_SUBNET_C = ec2.Subnet.fromSubnetId(this, "private c", "subnet-44646e1d");
    PUBLIC_SUBNET_A = ec2.Subnet.fromSubnetId(this, "public a", "subnet-0822a1312816de200");
    PUBLIC_SUBNET_B = ec2.Subnet.fromSubnetId(this, "public b", "subnet-039233503b6e31d8e");
    PUBLIC_SUBNET_C = ec2.Subnet.fromSubnetId(this, "public c", "subnet-013589611630ac1d0");
    ZIP_BUCKET = s3.Bucket.fromBucketName(this, "bucket", DEPLOYMENT_BUCKET);
    CONFIRM_LAMBDA = lambda.Function.fromFunctionName(this, "confirmFunc", "auth_confirm");
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.lookupExternalResources();

    // the VPC endpoint is so that the Lambdas inside the VPC can see the parameter store which is public.
    // this.defineVpcEndpoints();
    const threadFunction = this.defineLambda("misc_auth_thread", "auththread.handler", ["bgg"], "public", 1);
    const sm = this.defineAuthStateMachine(threadFunction);
    const rule = this.defineRuleToInvokeAuth(sm, 1);
    const reportFunction = this.defineLambda("misc_report_read", "report.handler", ["db"], "private", 2);
    const writeFunction = this.defineLambda("misc_report_write", "report.write", ["logging"], "public", 3);
    const sm2 = this.defineReportStateMachine(reportFunction, writeFunction);
    const rule2 = this.defineRuleToInvokeReport(sm2, 2);
  }
}
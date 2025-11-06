import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import {Duration, Tags} from "aws-cdk-lib";

const RUNTIME = lambda.Runtime.NODEJS_22_X;
const DEPLOYMENT_BUCKET = "extstats-deployment";
const COMPONENT = "api";
let ZIP_BUCKET: s3.IBucket | undefined = undefined;
let API_ROLE: iam.IRole | undefined = undefined;
let databaseVpc: ec2.IVpc = undefined;
let lambdaSubnet1: ec2.ISubnet = undefined;
let lambdaSubnet2: ec2.ISubnet = undefined;
let lambdaSubnet3: ec2.ISubnet = undefined;

export class ApiStack extends cdk.Stack {

  defineLambda(scope: Construct, name: string, handler: string): lambda.Function {
    const f = new lambda.Function(scope, name, {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: API_ROLE,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET,  COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
      allowPublicSubnet: true,
      vpc: databaseVpc,
      vpcSubnets: {
        subnets: [ lambdaSubnet1, lambdaSubnet2, lambdaSubnet3 ]
      }
    });
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    databaseVpc = ec2.Vpc.fromLookup(this, "vpc", { vpcId: "vpc-5c8a7a3b" });
    lambdaSubnet1 = ec2.Subnet.fromSubnetId(this, "private a", "subnet-f565d0bc");
    lambdaSubnet2 = ec2.Subnet.fromSubnetId(this, "private b", "subnet-a865decf");
    lambdaSubnet3 = ec2.Subnet.fromSubnetId(this, "private c", "subnet-44646e1d");

    API_ROLE = iam.Role.fromRoleName(this, "bob", "APILambdas");
    ZIP_BUCKET = s3.Bucket.fromBucketName(this, "b", DEPLOYMENT_BUCKET);
    const f1 = this.defineLambda(this, `${COMPONENT}_wartable`, "functions.getWarTable");

    // const endpoint = new apigw.LambdaRestApi(this, `ApiGwEndpoint`, {
    //   handler: f1,
    //   restApiName: `HelloApi`,
    // });

  }
}
import * as cdk from 'aws-cdk-lib';
import {aws_apigatewayv2, Duration, Tags} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cf from "aws-cdk-lib/aws-cloudfront";
import {HttpMethod, HttpRouteKey} from "aws-cdk-lib/aws-apigatewayv2";
import {HttpLambdaIntegration} from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {COMPONENT, DEPLOYMENT_BUCKET, LAMBDA_SPECS} from "./metadata.mts";

const RUNTIME = lambda.Runtime.NODEJS_22_X;

let ZIP_BUCKET: s3.IBucket | undefined = undefined;
let API_ROLE: iam.IRole | undefined = undefined;
let DATABASE_VPC: ec2.IVpc = undefined;
let PRIVATE_SUBNET_A: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_B: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_C: ec2.ISubnet = undefined;
let PUBLIC_SUBNET_A: ec2.ISubnet = undefined;
let PUBLIC_SUBNET_B: ec2.ISubnet = undefined;
let PUBLIC_SUBNET_C: ec2.ISubnet = undefined;
let API_GATEWAY: aws_apigatewayv2.IHttpApi = undefined;
let CLOUDFRONT: cf.IDistribution = undefined;

export class ApiStack extends cdk.Stack {

  defineLambda(scope: Construct, name: string, handler: string, route: string, method): lambda.Function {
    const f = new lambda.Function(scope, name, {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: API_ROLE,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET,  COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
      allowPublicSubnet: true,
      vpc: DATABASE_VPC,
      vpcSubnets: {
        subnets: [ PRIVATE_SUBNET_A, PRIVATE_SUBNET_B, PRIVATE_SUBNET_A ]
      }
    });
    Tags.of(f).add("component", COMPONENT);
    const r = new aws_apigatewayv2.HttpRoute(scope, route, {
      httpApi: API_GATEWAY,
      routeKey: HttpRouteKey.with(`/${route}`, method),
      integration: new HttpLambdaIntegration(`integration_${route}`, f, {
        timeout: Duration.seconds(29),
      })
    });
    return f;
  }

  lookupExternalResources() {
    // resources external to this stack
    DATABASE_VPC = ec2.Vpc.fromLookup(this, "vpc", { vpcId: "vpc-5c8a7a3b" });
    PRIVATE_SUBNET_A = ec2.Subnet.fromSubnetId(this, "private a", "subnet-f565d0bc");
    PRIVATE_SUBNET_B = ec2.Subnet.fromSubnetId(this, "private b", "subnet-a865decf");
    PRIVATE_SUBNET_C = ec2.Subnet.fromSubnetId(this, "private c", "subnet-44646e1d");
    PUBLIC_SUBNET_A = ec2.Subnet.fromSubnetId(this, "public a", "subnet-0822a1312816de200");
    PUBLIC_SUBNET_B = ec2.Subnet.fromSubnetId(this, "public b", "subnet-039233503b6e31d8e");
    PUBLIC_SUBNET_C = ec2.Subnet.fromSubnetId(this, "public c", "subnet-013589611630ac1d0");
    API_ROLE = iam.Role.fromRoleName(this, "role", "APILambdas");
    ZIP_BUCKET = s3.Bucket.fromBucketName(this, "bucket", DEPLOYMENT_BUCKET);
    API_GATEWAY = aws_apigatewayv2.HttpApi.fromHttpApiAttributes(this, "gateway", { httpApiId: "niiwhl9tva" });
    CLOUDFRONT = cf.Distribution.fromDistributionAttributes(this, "cloudfront", { distributionId: "E4GI7KJXHVJYQ", domainName: "d39mscfb68jdsy.cloudfront.net" });
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.lookupExternalResources();

    for (const spec of LAMBDA_SPECS) {
      if (spec.method === "GET") {
        this.defineLambda(this, spec.name, spec.handler, spec.route, HttpMethod.GET);
      } else if (spec.method === "POST") {
        this.defineLambda(this, spec.name, spec.handler, spec.route, HttpMethod.POST);
      } else {
        console.log("What's this?");
        console.log(spec);
      }
    }
  }
}
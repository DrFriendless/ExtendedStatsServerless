import * as cdk from 'aws-cdk-lib';
import {aws_apigatewayv2, Duration, Tags} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import {GatewayVpcEndpoint} from "aws-cdk-lib/aws-ec2";
import * as ddb from "aws-cdk-lib/aws-dynamodb";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwi from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as route53 from "aws-cdk-lib/aws-route53";
import {
  COMPONENT,
  DEPLOYMENT_BUCKET,
  EXPRESS_SPECS,
  LAMBDA_ONLY_SPECS,
  LAMBDA_SPECS
} from "./metadata.mts";
import {ApiGatewayv2DomainProperties} from "aws-cdk-lib/aws-route53-targets";

const RUNTIME = lambda.Runtime.NODEJS_22_X;

type PUBLIC_PRIVATE = "public" | "private";

// this has to be http or the API integrations don't work - https is only at CloudFront
const EXPRESS_BASE = "http://eb2.drfriendless.com";
let ZIP_BUCKET: s3.IBucket | undefined = undefined;
let DATABASE_VPC: ec2.IVpc = undefined;
let PRIVATE_SUBNET_A: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_B: ec2.ISubnet = undefined;
let PRIVATE_SUBNET_C: ec2.ISubnet = undefined;
let API_GATEWAY: aws_apigatewayv2.IHttpApi = undefined;
let STAR_CERT: acm.ICertificate = undefined;
let DRFRIENDLESS_ZONE: route53.IHostedZone = undefined;
let CREATE_EC2S: iam.IManagedPolicy = undefined;
let WRITE_CW: iam.IManagedPolicy = undefined;
let ACCESS_DYNAMO: iam.PolicyDocument = undefined;
let SEND_TO_DOWNLOADER: iam.PolicyDocument = undefined;

export class ApiStack extends cdk.Stack {
  lookupExternalResources() {
    // resources external to this stack
    DATABASE_VPC = ec2.Vpc.fromLookup(this, "vpc", { vpcId: "vpc-5c8a7a3b" });
    PRIVATE_SUBNET_A = ec2.Subnet.fromSubnetId(this, "private a", "subnet-f565d0bc");
    PRIVATE_SUBNET_B = ec2.Subnet.fromSubnetId(this, "private b", "subnet-a865decf");
    PRIVATE_SUBNET_C = ec2.Subnet.fromSubnetId(this, "private c", "subnet-44646e1d");
    ZIP_BUCKET = s3.Bucket.fromBucketName(this, "bucket", DEPLOYMENT_BUCKET);
    API_GATEWAY = aws_apigatewayv2.HttpApi.fromHttpApiAttributes(this, "gateway", { httpApiId: "niiwhl9tva" });
    STAR_CERT = acm.Certificate.fromCertificateArn(this, "stardrfriendless", "arn:aws:acm:ap-southeast-2:067508173724:certificate/aabe3460-bdd1-432c-863e-74514b1fa94b");
    DRFRIENDLESS_ZONE = route53.HostedZone.fromLookup(this, "zone", { domainName: "drfriendless.com" });
    CREATE_EC2S = iam.ManagedPolicy.fromManagedPolicyName(this, "createEC2s", "CreateEC2sForLambda");
    WRITE_CW = iam.ManagedPolicy.fromManagedPolicyName(this, "writeToCW", "WriteToCloudwatchLogs");
  }

  defineSendToDownloaderPolicy(): iam.PolicyDocument {
    const access = new iam.PolicyStatement();
    access.addActions("sqs:SendMessage");
    access.addResources("arn:aws:sqs:ap-southeast-2:067508173724:downloaderOutputQueue");
    return new iam.PolicyDocument({
      statements: [access]
    });
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

  defineApiRole(): iam.IRole {
    const policies: Record<string, iam.PolicyDocument> = {};
    policies[`policy_access_dynamo`] = ACCESS_DYNAMO;
    const managedPolicies: iam.IManagedPolicy[] = [
      CREATE_EC2S, WRITE_CW
    ];

    return new iam.Role(this, `role_api`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: managedPolicies,
    });
  }

  definePublicLambdaRole(): iam.Role {
    const policies: Record<string, iam.PolicyDocument> = {};

    const bggParameters = new iam.PolicyStatement();
    bggParameters.addActions("ssm:GetParameter", "ssm:GetParametersByPath", "ssm:GetParameters", "ssm:PutParameter");
    bggParameters.addResources(`arn:aws:ssm:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:parameter/extstats/downloader*`);
    const bggSecrets = new iam.PolicyStatement();
    bggSecrets.addActions("secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret");
    bggSecrets.addResources(`arn:aws:secretsmanager:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:secret:extstats/bgg*`);
    const invokePolicy = new iam.PolicyStatement;
    invokePolicy.addActions("lambda:InvokeFunction");
    invokePolicy.addResources(`arn:aws:lambda:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:function:api_*`);

    policies[`policy_send_to_downloader`] = SEND_TO_DOWNLOADER;
    policies[`policy_api_public`] = new iam.PolicyDocument({
      statements: [bggParameters, bggSecrets, invokePolicy]
    });

    const managedPolicies: iam.IManagedPolicy[] = [
      CREATE_EC2S, WRITE_CW,
      iam.ManagedPolicy.fromManagedPolicyName(this, "accessDB", "AccessDatabaseSecrets"),
    ];
    return new iam.Role(this, `role_public_api`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: managedPolicies,
    });
  }

  defineLambda(scope: Construct, name: string, handler: string, route: string, method: "GET" | "POST", role: iam.IRole,
               pp: PUBLIC_PRIVATE, memSize: number): lambda.Function {
    const m = (method === "GET") ? apigw.HttpMethod.GET : apigw.HttpMethod.POST;
    const vpcParams: Partial<lambda.FunctionProps> = {
      allowPublicSubnet: true,
      vpc: DATABASE_VPC,
      vpcSubnets: {
        subnets: [ PRIVATE_SUBNET_A, PRIVATE_SUBNET_B, PRIVATE_SUBNET_C ]
      },
      environment: {
        MYSQL_HOST: process.env.MYSQL_HOST,
        MYSQL_USERNAME: process.env.MYSQL_USERNAME,
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
        MYSQL_DATABASE: process.env.MYSQL_DATABASE,
        GEEKLIST_TOKEN: process.env.GEEKLIST_TOKEN,
        DOWNLOADER_QUEUE: process.env.DOWNLOADER_QUEUE
      },
    };
    const publicParams: Partial<lambda.FunctionProps> = {
      environment: {
        DOWNLOADER_QUEUE: process.env.DOWNLOADER_QUEUE
      }
    };
    const f = new lambda.Function(scope, name, {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET,  COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
      memorySize: memSize,
      ...(pp === "private") ? vpcParams : publicParams
    });
    Tags.of(f).add("component", COMPONENT);
    const r = new aws_apigatewayv2.HttpRoute(scope, route, {
      httpApi: API_GATEWAY,
      routeKey: apigw.HttpRouteKey.with(`/${route}`, m),
      integration: new apigwi.HttpLambdaIntegration(`integration_${route}`, f, {
        timeout: Duration.seconds(29),
      })
    });
    return f;
  }

  defineLambdaOnly(scope: Construct, name: string, handler: string, role: iam.IRole): lambda.Function {
    const f = new lambda.Function(scope, name, {
      functionName: name,
      runtime: RUNTIME,
      handler,
      role: role,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET,  COMPONENT + ".zip"),
      timeout: Duration.seconds(60),
      allowPublicSubnet: true,
      vpc: DATABASE_VPC,
      vpcSubnets: {
        subnets: [ PRIVATE_SUBNET_A, PRIVATE_SUBNET_B, PRIVATE_SUBNET_A ]
      },
      environment: {
        MYSQL_HOST: process.env.MYSQL_HOST,
        MYSQL_USERNAME: process.env.MYSQL_USERNAME,
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
        MYSQL_DATABASE: process.env.MYSQL_DATABASE
      }
    });
    Tags.of(f).add("component", COMPONENT);
    return f;
  }

  defineExpressRoute(scope: Construct, key: string, route: string, method: apigw.HttpMethod) {
    const r = new aws_apigatewayv2.HttpRoute(scope, route, {
      httpApi: API_GATEWAY,
      routeKey: apigw.HttpRouteKey.with(`/${route}`, method),
      integration: new apigwi.HttpUrlIntegration(`integration_${key}`, `${EXPRESS_BASE}/${route}`, {
        method
      })
    });
  }

  defineSocksRole(): iam.IRole {
    const policies: Record<string, iam.PolicyDocument> = {};
    policies[`policy_access_dynamo`] = ACCESS_DYNAMO;

    const loggingCloudWatch = new iam.PolicyStatement();
    loggingCloudWatch.addActions("logs:PutLogEvents", "logs:CreateLogStream", "logs:CreateLogGroup");
    loggingCloudWatch.addResources("*");
    policies[`policy_downloader_logging`] = new iam.PolicyDocument({
      statements: [loggingCloudWatch]
    });

    const managedPolicies: iam.IManagedPolicy[] = [ CREATE_EC2S ];

    return new iam.Role(this, `role_socks`, {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: policies,
      managedPolicies: managedPolicies,
    });
  }

  // allow access to DynamoDB from inside the VPC, this is free of charge
  defineGatewayEndpoints() {
    const ep: GatewayVpcEndpoint = DATABASE_VPC.addGatewayEndpoint("dddb", {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });
    Tags.of(ep).add("component", COMPONENT);
  }

  defineSockHandlerLambdas(socksRole: iam.IRole, table: ddb.ITable) {
    const funcProps = {
      runtime: RUNTIME,
      role: socksRole,
      code: lambda.Code.fromBucketV2(ZIP_BUCKET,  COMPONENT + ".zip"),
      allowPublicSubnet: true,
      environment: {
        TABLE_NAME: table.tableName
      }
    };
    const connHandler: lambda.IFunction = new lambda.Function(this, "sockconnlambda", {
      functionName: "socks_connect",
      handler: "socks.connectHandler",
      timeout: Duration.seconds(60),
      ...funcProps
    });
    const discoHandler: lambda.IFunction = new lambda.Function(this, "sockdiscolambda", {
      functionName: "socks_disconnect",
      handler: "socks.disconnectHandler",
      timeout: Duration.seconds(60),
      ...funcProps
    });
    const defaultHandler: lambda.IFunction = new lambda.Function(this, "sockdefaultlambda", {
      functionName: "socks_default",
      handler: "socks.messageHandler",
      timeout: Duration.seconds(60),
      ...funcProps
    });
    table.grantReadWriteData(connHandler);
    table.grantReadWriteData(discoHandler);
    table.grantReadWriteData(defaultHandler);
    Tags.of(connHandler).add("component", COMPONENT);
    Tags.of(discoHandler).add("component", COMPONENT);
    Tags.of(defaultHandler).add("component", COMPONENT);
    return { connHandler, discoHandler, defaultHandler };
  }

  createWebSocketsInfrastructure(domainName: string, tableName: string, stageName: string) {
    const table = new ddb.Table(this, 'sockTable', {
      tableName,
      partitionKey: { name: 'geek', type: ddb.AttributeType.STRING },
      sortKey: { name: "connectionId", type: ddb.AttributeType.STRING }
    });
    Tags.of(table).add("component", COMPONENT);
    this.defineGatewayEndpoints();


    const socksRole: iam.IRole = this.defineSocksRole();
    Tags.of(socksRole).add("component", COMPONENT);

    const socksDomainName: apigw.IDomainName = new apigw.DomainName(this, 'socksDomainName', {
      domainName,
      certificate: STAR_CERT
    });

    const { connHandler, discoHandler, defaultHandler } = this.defineSockHandlerLambdas(socksRole, table);
    const gw: apigw.WebSocketApi = new apigw.WebSocketApi(this, "socksgw", {
      apiName: "socks",
      description: "Websocket API for Extended Stats",
      connectRouteOptions: {
        integration: new apigwi.WebSocketLambdaIntegration("sockconn", connHandler, {})
      },
      disconnectRouteOptions: {
        integration: new apigwi.WebSocketLambdaIntegration("sockdisco", discoHandler, {})
      },
      defaultRouteOptions: {
        integration: new apigwi.WebSocketLambdaIntegration("sockdefault", defaultHandler, {})
      },
      ipAddressType: apigw.IpAddressType.DUAL_STACK
    });
    const apiStage = new apigw.WebSocketStage(this, 'sockStage', {
      webSocketApi: gw,
      stageName: stageName,
      autoDeploy: true,
      domainMapping: { domainName: socksDomainName }
    });
    Tags.of(gw).add("component", COMPONENT);
    Tags.of(apiStage).add("component", COMPONENT);
    gw.grantManageConnections(connHandler);
    gw.grantManageConnections(discoHandler);
    gw.grantManageConnections(defaultHandler);

    new route53.RecordSet(this, 'socksRecordSetA', {
      zone: DRFRIENDLESS_ZONE,
      recordType: route53.RecordType.A,
      recordName: 'socks',
      target: route53.RecordTarget.fromAlias(new ApiGatewayv2DomainProperties(socksDomainName.regionalDomainName, socksDomainName.regionalHostedZoneId))
    })

    new route53.RecordSet(this, 'socksRecordSetAAAA', {
      zone: DRFRIENDLESS_ZONE,
      recordType: route53.RecordType.AAAA,
      recordName: 'socks',
      target: route53.RecordTarget.fromAlias(new ApiGatewayv2DomainProperties(socksDomainName.regionalDomainName, socksDomainName.regionalHostedZoneId))
    })

    const route = new aws_apigatewayv2.WebSocketRoute(this, "sockmessageroute", {
      webSocketApi: gw,
      routeKey: "sendmessage",
      integration: new apigwi.WebSocketLambdaIntegration(`integration_sock_message`, defaultHandler, { })
    });
    Tags.of(route).add("component", COMPONENT);

    new cdk.CfnOutput(this, 'socksGateway', {
      value: gw.apiEndpoint,
      exportName: 'api-socksGateway'
    });
  }

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.lookupExternalResources();
    ACCESS_DYNAMO = this.defineAccessDynamoPolicy();
    SEND_TO_DOWNLOADER = this.defineSendToDownloaderPolicy();

    this.createWebSocketsInfrastructure("socks.drfriendless.com", "websocket_connections", "live");

    const apiRole = this.defineApiRole();
    const publicRole = this.definePublicLambdaRole();
    for (const spec of LAMBDA_SPECS) {
      const role = (spec.pp && spec.pp === "public") ? publicRole : apiRole;
      this.defineLambda(this, spec.name, spec.handler, spec.route, spec.method, role, spec.pp || "private", spec.memSize || 128);
    }
    for (const spec of LAMBDA_ONLY_SPECS) {
      this.defineLambdaOnly(this, spec.name, spec.handler, apiRole);
    }

    for (const spec of EXPRESS_SPECS) {
      if (spec.method === "GET") {
        this.defineExpressRoute(this, spec.key, spec.route, apigw.HttpMethod.GET);
      } else if (spec.method === "POST") {
        this.defineExpressRoute(this, spec.key, spec.route, apigw.HttpMethod.POST);
      }
    }
  }
}
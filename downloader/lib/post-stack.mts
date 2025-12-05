import {LambdaClient, UpdateEventSourceMappingCommand, UpdateFunctionCodeCommand} from "@aws-sdk/client-lambda";
import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    PutRetentionPolicyCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {COMPONENT, DEPLOYMENT_BUCKET, REGION, PROFILE, LAMBDA_SPECS} from "./metadata.mts";
import {CloudFormationClient, ListExportsCommand} from "@aws-sdk/client-cloudformation";
import {PutParameterCommand, SSMClient} from "@aws-sdk/client-ssm";

const CREDENTIALS = { region: REGION, profile: PROFILE };

async function updateCode(client: LambdaClient, funcName: string) {
    const command = new UpdateFunctionCodeCommand({
        S3Bucket: DEPLOYMENT_BUCKET,
        S3Key: `${COMPONENT}.zip`,
        FunctionName: funcName,
        Publish: true
    });
    const r = await client.send(command);
    console.log(`${r.FunctionArn} ${r.LastModified}`);
}

// poke the lambdas to tell them they may have new code
console.log("Telling Lambdas they have new code");
const lClient = new LambdaClient(CREDENTIALS);
for (const spec of LAMBDA_SPECS) {
    await updateCode(lClient, spec.name);
}

// set the retention period on the log groups
console.log("Changing retention period on log groups");
const cwClient = new CloudWatchLogsClient(CREDENTIALS);
const cmd = new DescribeLogGroupsCommand({ logGroupNamePrefix: `/aws/lambda/${COMPONENT}_`,  });
const gs = await cwClient.send(cmd);
for (const g of gs.logGroups) {
    const pcmd = new PutRetentionPolicyCommand({ logGroupName: g.logGroupName, retentionInDays: 1 });
    const r = await cwClient.send(pcmd);
    console.log(r.$metadata.httpStatusCode, g.logGroupName);
}

const ssmClient = new SSMClient(CREDENTIALS);
const client = new CloudFormationClient(CREDENTIALS);
const command = new ListExportsCommand({ });
const response = await client.send(command);
for (const e of response.Exports) {
    if (e.Name === "downloader-OutputQueueURL") {
        // put the queue URL where insideq can find it
        console.log("Updating queue URL in Parameter Store");
        const ssmCmd = new PutParameterCommand({
            Name: "/extstats/downloader/queue",
            Value: e.Value,
            Overwrite: true,
            Type: "String"
        });
        const r2 = await ssmClient.send(ssmCmd);
        console.log(r2.$metadata.httpStatusCode);
    } else if (e.Name === "downloader-PlaysQueueURL") {
        // put the queue URL where insideq can find it
        console.log("Updating plays queue URL in Parameter Store");
        const ssmCmd = new PutParameterCommand({
            Name: "/extstats/downloader/playsqueue",
            Value: e.Value,
            Overwrite: true,
            Type: "String"
        });
        const r2 = await ssmClient.send(ssmCmd);
        console.log(r2.$metadata.httpStatusCode);
    } else if (e.Name === "downloader-PlaysMappingUUID") {
        // turn on the plays lambda processing from the plays queue
        console.log("Turning on plays queue");
        const lCmd = new UpdateEventSourceMappingCommand({
            Enabled: true,
            UUID: e.Value
        });
        const r3 = await lClient.send(lCmd);
        console.log(r3.$metadata.httpStatusCode);
    } else {
        console.log(e.Name);
    }
}
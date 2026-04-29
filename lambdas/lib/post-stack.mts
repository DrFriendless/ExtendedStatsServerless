import {LambdaClient, UpdateEventSourceMappingCommand, UpdateFunctionCodeCommand} from "@aws-sdk/client-lambda";
import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    PutRetentionPolicyCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {PutParameterCommand, SSMClient} from "@aws-sdk/client-ssm";
import {CloudFormationClient, ListExportsCommand} from "@aws-sdk/client-cloudformation";
import {COMPONENT, DEPLOYMENT_BUCKET, REGION, PROFILE} from "./metadata.mts";

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
const lClient = new LambdaClient({ region: REGION, profile: PROFILE });
await updateCode(lClient, "misc_auth_thread");
await updateCode(lClient, "misc_counts");
await updateCode(lClient, "misc_cw");
await updateCode(lClient, "misc_message");
await updateCode(lClient, "misc_daily");
// await updateCode(lClient, "misc_report_read");
// await updateCode(lClient, "misc_report_write");
// set the retention period on the log groups
const cwClient = new CloudWatchLogsClient({ region: REGION, profile: PROFILE });
const cmd = new DescribeLogGroupsCommand({ logGroupNamePrefix: "/aws/lambda/misc_",  });
const gs = await cwClient.send(cmd);
for (const g of gs.logGroups) {
    const pcmd = new PutRetentionPolicyCommand({ logGroupName: g.logGroupName, retentionInDays: 1 });
    const r = await cwClient.send(pcmd);
    console.log(g.logGroupName, r.$metadata.httpStatusCode);
}

const ssmClient = new SSMClient(CREDENTIALS);
const client = new CloudFormationClient(CREDENTIALS);
const command = new ListExportsCommand({ });
const response = await client.send(command);
for (const e of response.Exports) {
    if (e.Name === "misc-MessageQueueURL") {
        console.log("Updating Message Queue URL in Parameter Store");
        const ssmCmd = new PutParameterCommand({
            Name: "/extstats/misc/messages",
            Value: e.Value,
            Overwrite: true,
            Type: "String"
        });
        const r = await ssmClient.send(ssmCmd);
        console.log(r.$metadata.httpStatusCode);
    } else if (e.Name === "misc-MessageMappingUUID") {
        // turn on the processing from the message queue
        console.log("Turning on message queue");
        const lCmd = new UpdateEventSourceMappingCommand({
            Enabled: true,
            UUID: e.Value
        });
        const r3 = await lClient.send(lCmd);
        console.log(r3.$metadata.httpStatusCode);
    }
}

// Look up the log groups with DescribeLogGroups.
//     Filter by setting logGroupNamePrefix: "/aws/codebuild/MyPipeline".
//     Invoke PutRetentionPolicy for each log group name.
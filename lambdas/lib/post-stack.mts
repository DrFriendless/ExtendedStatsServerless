import {LambdaClient, UpdateFunctionCodeCommand} from "@aws-sdk/client-lambda";
import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    PutRetentionPolicyCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {COMPONENT, DEPLOYMENT_BUCKET, REGION, PROFILE} from "./metadata.mts";

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
// await updateCode(lClient, "misc_report_read");
// await updateCode(lClient, "misc_report_write");
// set the retention period on the log groups
const cwClient = new CloudWatchLogsClient({ region: REGION, profile: PROFILE });
const cmd = new DescribeLogGroupsCommand({ logGroupNamePrefix: "/aws/lambda/misc_",  });
const gs = await cwClient.send(cmd);
for (const g of gs.logGroups) {
    const pcmd = new PutRetentionPolicyCommand({ logGroupName: g.logGroupName, retentionInDays: 1 });
    const r = await cwClient.send(pcmd);
    console.log(r);
}

// Look up the log groups with DescribeLogGroups.
//     Filter by setting logGroupNamePrefix: "/aws/codebuild/MyPipeline".
//     Invoke PutRetentionPolicy for each log group name.
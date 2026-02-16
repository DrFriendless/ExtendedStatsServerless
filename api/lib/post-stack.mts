import {
    DeleteFunctionCommand,
    LambdaClient,
    ListFunctionsCommand,
    ListVersionsByFunctionCommand,
    UpdateFunctionCodeCommand
} from "@aws-sdk/client-lambda";
import {
    CloudWatchLogsClient,
    DescribeLogGroupsCommand,
    PutRetentionPolicyCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {CloudFormationClient, ListExportsCommand} from "@aws-sdk/client-cloudformation";
import {PutParameterCommand, SSMClient} from "@aws-sdk/client-ssm";
import {
    COMPONENT,
    DEPLOYMENT_BUCKET,
    REGION,
    PROFILE,
    LAMBDA_SPECS,
    LAMBDA_ONLY_SPECS,
    OTHER_LAMBDA_NAMES
} from "./metadata.mts";

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

const CREDENTIALS = { region: REGION, profile: PROFILE };
// poke the lambdas to tell them they may have new code
console.log("Telling Lambdas they have new code");
const lClient = new LambdaClient(CREDENTIALS);
for (const spec of LAMBDA_SPECS) {
    await updateCode(lClient, spec.name);
}
for (const spec of LAMBDA_ONLY_SPECS) {
    await updateCode(lClient, spec.name);
}
for (const name of OTHER_LAMBDA_NAMES) {
    await updateCode(lClient, name);
}

// set the retention period on the log groups
console.log("Setting retention period on log groups");
const cwClient = new CloudWatchLogsClient(CREDENTIALS);
for (const prefix of ["api","auth","socks"]) {
    const cmd = new DescribeLogGroupsCommand({ logGroupNamePrefix: `/aws/lambda/${prefix}_`,  });
    const gs = await cwClient.send(cmd);
    for (const g of gs.logGroups) {
        const pcmd = new PutRetentionPolicyCommand({ logGroupName: g.logGroupName, retentionInDays: 1 });
        const r = await cwClient.send(pcmd);
        console.log(r.$metadata.httpStatusCode, g.logGroupName);
    }
}

console.log("Deleting old versions of Lambdas");
const functionsCommand = new ListFunctionsCommand();
const fs = await lClient.send(functionsCommand);
for (const f of fs.Functions) {
    const versionsCommand = new ListVersionsByFunctionCommand({ FunctionName: f.FunctionName });
    const vs = await lClient.send(versionsCommand);
    for (const v of vs.Versions) {
        if (v.Version !== f.Version) {
            const deleteCommand = new DeleteFunctionCommand({ FunctionName: v.FunctionArn });
            const r = await lClient.send(deleteCommand);
            console.log(r.$metadata.httpStatusCode, v.FunctionArn );
        }
    }
}

const client = new CloudFormationClient(CREDENTIALS);
const ssmClient = new SSMClient(CREDENTIALS);
const command = new ListExportsCommand({ });
const response = await client.send(command);
console.log();
console.log("STACK OUTPUTS");
for (const e of response.Exports) {
    console.log(e.Name, e.Value);
    if (e.Name === "api-socksGateway") {
        const ssmCmd = new PutParameterCommand({
            Name: "/extstats/api/socks-endpoint",
            Value: e.Value,
            Overwrite: true,
            Type: "String"
        });
        const r3 = await ssmClient.send(ssmCmd);
    }
}
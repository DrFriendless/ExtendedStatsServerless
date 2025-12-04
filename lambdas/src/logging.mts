// Logging to CloudWatch for Extended Stata
import {
    CloudWatchLogsClient,
    CloudWatchLogsClientConfig,
    InputLogEvent, CreateLogStreamCommand,
    PutLogEventsCommand
} from "@aws-sdk/client-cloudwatch-logs";
import {System} from "./system.mjs";

let client: CloudWatchLogsClient;

const logParams = {
    "logGroupName": undefined as string,
    "streamName": undefined as string,
    "buffer": [] as InputLogEvent[]
};

export async function initLogging(system: System, streamName: string) {
    const config: CloudWatchLogsClientConfig = {
        region: "ap-southeast-2",
    };
    client = new CloudWatchLogsClient(config);
    logParams.logGroupName = system.systemLogGroup;
    logParams.streamName = streamName;
}

export function log(message: string) {
    logParams.buffer.push({
        timestamp: Date.now(),
        message: message
    });
}

export async function flushLogging() {
    if (logParams.buffer.length === 0) return;
    const d = new Date();
    const ts = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const logStreamName = `${logParams.streamName}-${ts}`;
    console.log("A");
    await client.send(new CreateLogStreamCommand({
        logGroupName: logParams.logGroupName,
        logStreamName: logStreamName,
    })).catch(ex => console.log(ex));
    console.log("B");
    await client.send(new PutLogEventsCommand({
        logGroupName: logParams.logGroupName,
        logStreamName: logStreamName,
        logEvents: [ ...logParams.buffer ]
    })).catch(err => console.log(err));
    console.log("C");
    logParams.buffer = [];
}
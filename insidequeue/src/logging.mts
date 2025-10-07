// Logging to CloudWatch for Extended Stata
import {
    CloudWatchLogsClient,
    CloudWatchLogsClientConfig,
    InputLogEvent, CreateLogStreamCommand,
    PutLogEventsCommand, PutLogEventsRequest
} from "@aws-sdk/client-cloudwatch-logs";
import {System} from "./system.mjs";

const config: CloudWatchLogsClientConfig = {};
const client = new CloudWatchLogsClient(config);

const logParams = {
    "logGroupName": undefined as string,
    "streamName": undefined as string,
    "buffer": [] as InputLogEvent[]
};

export async function initLogging(system: System, streamName: string) {
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
    console.log(logParams.logGroupName, logStreamName);
    const r = await client.send(new CreateLogStreamCommand({
        logGroupName: logParams.logGroupName,
        logStreamName: logStreamName,
    }));
    const input: PutLogEventsRequest = { //
        logGroupName: logParams.logGroupName,
        logStreamName: logStreamName,
        logEvents: [ ...logParams.buffer ]
    };
    const command = new PutLogEventsCommand(input);
    const response = await client.send(command);
    logParams.buffer = [];
}
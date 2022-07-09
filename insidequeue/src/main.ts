import {
    GetQueueUrlCommand,
    Message,
    ReceiveMessageCommand,
    ReceiveMessageCommandInput,
    SQSClient
} from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import * as process from "process";
const S3StreamLogger = require('s3-streamlogger').S3StreamLogger;

dotenv.config({ path: ".env" });

// Set the AWS Region.
const REGION = process.env.AWS_REGION;
const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY || "", secretAccessKey: process.env.AWS_SECRET_KEY || "" };
// Create an Amazon S3 service client object.
const sqsClient = new SQSClient({ region: REGION, credentials: credentials });

const logstream = new S3StreamLogger({
    bucket: process.env.LOG_BUCKET,
    access_key_id: credentials.accessKeyId,
    secret_access_key: credentials.secretAccessKey
});

async function main() {
    const command = new GetQueueUrlCommand({ QueueName: process.env.INSIDE_QUEUE, QueueOwnerAWSAccountId: process.env.AWS_ACCOUNT });
    const response = await sqsClient.send(command);
    const queueUrl = response.QueueUrl;
    console.log("Logging to bucket " + process.env.LOG_BUCKET);
    while (true) {
        console.log(`Waiting for queue ${queueUrl}`);
        const input: ReceiveMessageCommandInput = { QueueUrl: queueUrl, WaitTimeSeconds: 20, MaxNumberOfMessages: 1 };
        const command = new ReceiveMessageCommand(input);
        const response = await sqsClient.send(command);
        if (response.Messages) {
            handleMessages(response.Messages);
        } else {
            logstream.write("Still no messages.\n");
            console.log("No messages");
        }
    }
    logstream.write("We terminated.\n");
}

function handleMessages(messages: Message[]) {

}

main().then(() => console.log("Done."));
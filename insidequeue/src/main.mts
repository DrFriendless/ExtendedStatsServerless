
import mysql from 'promise-mysql';
import {
    DeleteMessageCommand,
    GetQueueUrlCommand,
    Message,
    ReceiveMessageCommand,
    ReceiveMessageCommandInput,
    SQSClient
} from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import process from "process";
import { QueueMessage } from "extstats-core";
import {
    doEnsureUsers,
    doMarkGameDoesNotExist,
    doMarkUrlProcessed,
    doMarkUrlTryTomorrow, doMarkUrlUnprocessed,
    doProcessCollectionCleanup,
    doProcessGameResult, doProcessPlayedMonths, doProcessPlaysResult,
    doUpdateBGGTop50, doUpdateGamesForGeek, doUpdateMetadata, doUpdateProcessUserResult
} from "./mysql-rds.mjs";
import { S3StreamLogger } from "s3-streamlogger";

dotenv.config({ path: ".env" });

// Set the AWS Region.
const REGION = process.env.AWS_REGION;
// Create an Amazon S3 service client object.
// Credentials are granted to the EC2 hosting this so we don't need to add them here.
const sqsClient = new SQSClient({ region: REGION });

const logstream = new S3StreamLogger({
    bucket: process.env.LOG_BUCKET
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
            await handleMessages(response.Messages, queueUrl);
        } else {
            logstream.write("Still no messages.\n");
            console.log("No messages");
        }
    }
    logstream.write("We terminated.\n");
}

async function handleMessages(messages: Message[], queueUrl: string): Promise<void> {
    for (const message of messages) {
        console.log(message);
        const receiptHandle = message.ReceiptHandle;
        if (message.Body) {
            const payload = JSON.parse(message.Body);
            console.log(payload);
            await handleQueueMessage(payload as QueueMessage);
        }
        await sqsClient.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle }));
    }
}

async function handleQueueMessage(message: QueueMessage) {
    switch (message.discriminator) {
        case "CleanUpCollectionMessage":
            await withConnectionAsync(conn => doProcessCollectionCleanup(conn, message.params.geek, message.params.items, message.params.url));
            break;
        case "CollectionResultMessage":
            await withConnectionAsync(conn => doUpdateGamesForGeek(conn, message.result.geek, message.result.items));
            break;
        case "GameResultMessage":
            await withConnectionAsync(conn => doProcessGameResult(conn, message.result));
            break;
        case "MarkAsProcessedMessage":
            await withConnectionAsync(conn => doMarkUrlProcessed(conn, message.fileDetails.processMethod, message.fileDetails.url));
            break;
        case "MarkAsTryAgainMessage":
            await withConnectionAsync(conn => doMarkUrlTryTomorrow(conn, message.fileDetails.processMethod, message.fileDetails.url));
            break;
        case "MarkAsUnprocessedMessage":
            await withConnectionAsync(conn => doMarkUrlUnprocessed(conn, message.fileDetails.processMethod, message.fileDetails.url));
            break;
        case "NoSuchGameMessage":
            await withConnectionAsync(conn => doMarkGameDoesNotExist(conn, message.gameId));
            break;
        case "PlayedResultMessage":
            await withConnectionAsync(conn => doProcessPlayedMonths(conn, message.monthsData.geek, message.monthsData.monthsPlayed, message.monthsData.url));
            break;
        case "PlaysResultMessage":
            await withConnectionAsync(conn => doProcessPlaysResult(conn, message.result));
            break;
        case "UpdateMetadataMessage":
            await withConnectionAsync(conn => doUpdateMetadata(conn, message.metadata.series, message.metadata.rules));
            break;
        case "UpdateTop50Message":
            await withConnectionAsync(conn => doUpdateBGGTop50(conn, message.top50));
            break;
        case "UpdateUserListMessage":
            await withConnectionAsync(conn => doEnsureUsers(conn, message.users));
            break;
        case "UserResultMessage":
            await withConnectionAsync(conn =>
                doUpdateProcessUserResult(conn, message.result.geek, message.result.bggid, message.result.country, message.result.url));
            break;
        default:
            // this should not happen
            console.log(`${message} not handled.`);
            break;
    }
}

async function withConnectionAsync(func: (conn: mysql.Connection) => Promise<any>) {
    const connection = await getConnection();
    try {
        await func(connection);
        connection.destroy();
    } catch (e) {
        connection.destroy();
        throw e;
    }
}

function returnWithConnection<T>(func: (conn: mysql.Connection) => PromiseLike<T>): Promise<T> {
    let connection: mysql.Connection;
    let result: PromiseLike<T>;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => result = func(conn))
        .then(() => connection.destroy())
        .catch(err => {
            connection.destroy();
            throw err;
        })
        .then(() => result);
}

async function getConnection(): Promise<mysql.Connection> {
    const params = {
        host: process.env.mysqlHost,
        user: process.env.mysqlUsername,
        password: process.env.mysqlPassword,
        database: process.env.mysqlDatabase
    };
    return mysql.createConnection(params);
}

main()
    .catch(err => console.log(err))
    .then(() => console.log("Done."))
    .catch(() => 'obligatory catch');
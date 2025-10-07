
import mysql from 'promise-mysql';
import {
    DeleteMessageCommand,
    Message,
    ReceiveMessageCommand,
    ReceiveMessageCommandInput,
    SQSClient
} from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import process from "process";
import {QueueMessage, ToProcessElement} from "extstats-core";
import {
    doEnsureUsers, doListToProcess,
    doMarkGameDoesNotExist,
    doMarkUrlProcessed,
    doMarkUrlTryTomorrow, doMarkUrlUnprocessed,
    doProcessCollectionCleanup,
    doProcessGameResult, doProcessPlayedMonths, doProcessPlaysResult,
    doUpdateBGGTop50, doUpdateGamesForGeek, doUpdateMetadata, doUpdateProcessUserResult
} from "./mysql-rds.mjs";
import {invokeLambdaAsync} from "./library.mjs";
import {loadSystem} from "./system.mjs";
import {flushLogging, initLogging, log} from "./logging.mjs";

const OUTSIDE_PREFIX = "downloader-";

// method names from the database - this is the type of thing we have to do.
const METHOD_PROCESS_USER = "processUser";
const METHOD_PROCESS_COLLECTION = "processCollection";
const METHOD_PROCESS_PLAYED = "processPlayed";
const METHOD_PROCESS_GAME = "processGame";
const METHOD_PROCESS_PLAYS = "processPlays";
const METHOD_PROCESS_DESIGNER = "processDesigner";
const METHOD_PROCESS_PUBLISHER = "processPublisher";

// lambda names we expect to see
const FUNCTION_RETRIEVE_FILES = "getToProcessList";
const FUNCTION_UPDATE_USER_LIST = "updateUserList";
const FUNCTION_PROCESS_USER = "processUser";
const FUNCTION_PROCESS_COLLECTION = "processCollection";
const FUNCTION_PROCESS_GAME = "processGame";
const FUNCTION_PROCESS_PLAYS = "processPlays";
const FUNCTION_PROCESS_DESIGNER = "processDesigner";
const FUNCTION_PROCESS_PUBLISHER = "processPublisher";
const FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES = "processCollectionUpdateGames";
const FUNCTION_PROCESS_PLAYED = "processPlayed";

dotenv.config({ path: ".env" });

// Set the AWS Region.
const REGION = process.env.AWS_REGION;
// Create an Amazon S3 service client object.
// Credentials are granted to the EC2 hosting this so we don't need to add them here.
const sqsClient = new SQSClient({ region: REGION });

async function main() {
    const system = await loadSystem();
    await initLogging(system, "InsideQueue");
    // TODO - do I need to send the account ID?
    while (true) {
        console.log(`Waiting for queue ${system.downloaderQueue}`);
        const input: ReceiveMessageCommandInput = { QueueUrl: system.downloaderQueue, WaitTimeSeconds: 20, MaxNumberOfMessages: 1 };
        const command = new ReceiveMessageCommand(input);
        const response = await sqsClient.send(command);
        if (response.Messages) {
            await handleMessages(response.Messages, system.downloaderQueue);
        } else {
            console.log("No messages");
            await noMessages();
        }
    }
    log("We terminated.");
    await flushLogging();
}

async function noMessages() {
    // TODO - allow more than one
    // TODO - allow a variety of types
    const todo: ToProcessElement[] = await returnWithConnection(conn => doListToProcess(conn, 1, "processUser", false))
    for (const element of todo) {
        // TODO - invoke appropriate lambda
        if (element.processMethod === METHOD_PROCESS_USER) {
            console.log(`scheduling processUser ${element.geek}`);
            return invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_USER, element);
        } else if (element.processMethod === METHOD_PROCESS_COLLECTION) {
            return invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION, element);
        } else if (element.processMethod === METHOD_PROCESS_PLAYED) {
            return invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_PLAYED, element);
        } else if (element.processMethod === METHOD_PROCESS_GAME) {
            return invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_GAME, element);
        } else if (element.processMethod === METHOD_PROCESS_PLAYS) {
            return invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_PLAYS, element);
        } else if (element.processMethod === METHOD_PROCESS_DESIGNER) {
            return invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_DESIGNER, element);
        } else if (element.processMethod === METHOD_PROCESS_PUBLISHER) {
            return invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_PUBLISHER, element);
        }
    }
}

async function handleMessages(messages: Message[], queueUrl: string): Promise<void> {
    log(`Retrieved ${messages.length} messages from downloader queue`);
    for (const message of messages) {
        const receiptHandle = message.ReceiptHandle;
        if (message.Body) {
            const payload = JSON.parse(message.Body);
            console.log(payload);
            await handleQueueMessage(payload as QueueMessage);
        } else {
            console.log("What is this?");
            console.log(JSON.stringify(message));
        }
        await sqsClient.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle }));
    }
    await flushLogging();
}

async function handleQueueMessage(message: QueueMessage) {
    log(message.discriminator);
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
            log(`${message} not handled.`);
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

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
import {FileToProcess, ProcessMethod, QueueMessage, ToProcessElement} from "extstats-core";
import {
    doEnsureUsers,
    doListToProcess,
    doEnsureGames,
    doMarkGameDoesNotExist,
    doMarkUrlProcessed,
    doMarkUrlTryTomorrow,
    doMarkUrlUnprocessed,
    doProcessCollectionCleanup,
    doProcessGameResult,
    doProcessPlayedMonths,
    doProcessPlaysResult,
    doUpdateBGGTop50,
    doUpdateGamesForGeek,
    doUpdateMetadata,
    doUpdateProcessUserResult,
    doMarkGeekDoesNotExist,
    getGeeksThatDontExist
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
const FUNCTION_PROCESS_USER = "processUser";
const FUNCTION_PROCESS_COLLECTION = "processCollection";
const FUNCTION_PROCESS_GAME = "processGame";
const FUNCTION_PROCESS_PLAYS = "processPlays";
const FUNCTION_PROCESS_DESIGNER = "processDesigner";
const FUNCTION_PROCESS_PUBLISHER = "processPublisher";
const FUNCTION_PROCESS_PLAYED = "processPlayed";

dotenv.config({ path: ".env", quiet: true });


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
        const input: ReceiveMessageCommandInput = { QueueUrl: system.downloaderQueue, WaitTimeSeconds: 20, MaxNumberOfMessages: 10 };
        const command = new ReceiveMessageCommand(input);
        const response = await sqsClient.send(command);
        if (response.Messages) {
            await handleMessages(response.Messages, system.downloaderQueue);
            await noMessages(1);
        } else {
            console.log("No messages");
            await noMessages(20);
        }
    }
    log("We terminated.");
    await flushLogging();
}

async function scheduleProcessing(element: ToProcessElement) {
    // TODO - invoke appropriate lambda
    if (element.processMethod === METHOD_PROCESS_USER) {
        console.log(`scheduling processUser ${element.geek}`);
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_USER, element);
    } else if (element.processMethod === METHOD_PROCESS_COLLECTION) {
        console.log(`scheduling processCollection ${element.geek}`);
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION, element);
    } else if (element.processMethod === METHOD_PROCESS_PLAYED) {
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_PLAYED, element);
    } else if (element.processMethod === METHOD_PROCESS_GAME) {
        console.log(`scheduling processGame ${element.bggid}`);
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_GAME, element);
    } else if (element.processMethod === METHOD_PROCESS_PLAYS) {
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_PLAYS, element);
    } else if (element.processMethod === METHOD_PROCESS_DESIGNER) {
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_DESIGNER, element);
    } else if (element.processMethod === METHOD_PROCESS_PUBLISHER) {
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_PUBLISHER, element);
    }
}

async function noMessages(howManyToDo: number) {
    const geeksThatDontExist = await returnWithConnection(getGeeksThatDontExist);
    // TODO - allow a variety of types
    const todo: ToProcessElement[] =
        await returnWithConnection(conn =>
            doListToProcess(conn, howManyToDo, ["processUser", "processCollection", "processGame"], false))
    for (const element of todo) {
        if (!!element.geek && geeksThatDontExist.includes(element.geek)) {
            // this shouldn't happen.
            log(`Geek ${element.geek} doesn't even exist.`);
            await withConnectionAsync(conn => doMarkUrlProcessed(conn, element.processMethod as ProcessMethod, element.url));
        } else {
            await scheduleProcessing(element);
        }
    }
}

async function handleMessages(messages: Message[], queueUrl: string): Promise<void> {
    console.log(`Retrieved ${messages.length} messages from downloader queue`);
    for (const message of messages) {
        const receiptHandle = message.ReceiptHandle;
        if (message.Body) {
            const payload = JSON.parse(message.Body);
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
    switch (message.discriminator) {
        case "CleanUpCollectionMessage":
            console.log(`CleanUpCollectionMessage ${message.params.geek} ${message.params.items.length}`);
            await withConnectionAsync(conn => doProcessCollectionCleanup(conn, message.params.geek, message.params.items, message.params.url));
            break;
        case "CollectionResultMessage":
            console.log(`CollectionResultMessage ${message.result.geek} ${message.result.items.length}`);
            await withConnectionAsync(conn => doUpdateGamesForGeek(conn, message.result.geek, message.result.items));
            break;
        case "EnsureGamesMessage":
            console.log(`EnsureGamesMessage ${message.gameIds.length}`);
            await withConnectionAsync(conn => doEnsureGames(conn, message.gameIds));
            break;
        case "GameResultMessage":
            console.log(`GameResultMessage ${message.result.name}`);
            await withConnectionAsync(conn => doProcessGameResult(conn, message.result));
            break;
        case "MarkAsProcessedMessage":
            console.log(JSON.stringify(message));
            await withConnectionAsync(conn => doMarkUrlProcessed(conn, message.fileDetails.processMethod as ProcessMethod, message.fileDetails.url));
            break;
        case "MarkAsTryAgainMessage":
            console.log(JSON.stringify(message));
            await withConnectionAsync(conn => doMarkUrlTryTomorrow(conn, message.fileDetails.processMethod, message.fileDetails.url));
            break;
        case "MarkAsUnprocessedMessage":
            console.log(`MarkAsUnprocessedMessage ${message.fileDetails.processMethod} ${message.fileDetails.geek}`)
            await withConnectionAsync(conn => doMarkUrlUnprocessed(conn, message.fileDetails.processMethod, message.fileDetails.url));
            // reschedule while BGG has the data.
            const fd: FileToProcess = message.fileDetails;
            if (message.fileDetails.processMethod === "processCollection") {
                console.log(`rescheduling processCollection for ${fd.geek}`);
                const toProcess: ToProcessElement = {
                    ...fd,
                    lastUpdate: null,
                    nextUpdate: null,
                    description: "",
                    lastattempt: null,
                    last_scheduled: null,
                    month: null,
                    year: null,
                    geekid: 0
                };
                setTimeout(() => scheduleProcessing(toProcess), 60);
            }
            break;
        case "NoSuchGameMessage":
            console.log(JSON.stringify(message));
            await withConnectionAsync(conn => doMarkGameDoesNotExist(conn, message.gameId));
            break;
        case "NoSuchGeekMessage":
            console.log(`NoSuchGeek ${message.geek}`);
            await withConnectionAsync(conn => doMarkGeekDoesNotExist(conn, message.geek));
            break;
        case "PlayedResultMessage":
            console.log(JSON.stringify(message));
            await withConnectionAsync(conn => doProcessPlayedMonths(conn, message.monthsData.geek, message.monthsData.monthsPlayed, message.monthsData.url));
            break;
        case "PlaysResultMessage":
            console.log(JSON.stringify(message));
            await withConnectionAsync(conn => doProcessPlaysResult(conn, message.result));
            break;
        case "UpdateMetadataMessage":
            console.log(JSON.stringify(message));
            await withConnectionAsync(conn => doUpdateMetadata(conn, message.metadata.series, message.metadata.rules));
            break;
        case "UpdateTop50Message":
            console.log(JSON.stringify(message));
            await withConnectionAsync(conn => doUpdateBGGTop50(conn, message.top50));
            break;
        case "UpdateUserListMessage":
            console.log("UpdateUserListMessage");
            await withConnectionAsync(conn => doEnsureUsers(conn, message.users));
            break;
        case "UserResultMessage":
            console.log(`UserResultMessage ${message.result.geek}`);
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
import dateFormat from "dateformat";
import {
    DeleteMessageCommand,
    Message,
    ReceiveMessageCommand,
    ReceiveMessageCommandInput,
    SQSClient
} from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import process from "process";
import {
    EnsureGamesMessage,
    PlaysForPeriodResultMessage,
    FileToProcess,
    ProcessMethod,
    QueueMessage,
    ToProcessElement, RequestStats
} from "extstats-core";
import {
    doEnsureUsers,
    doEnsureGames,
    doMarkGameDoesNotExist,
    doMarkUrlProcessed,
    doMarkUrlTryTomorrow,
    doProcessCollectionCleanup,
    doProcessGameResult,
    doUpdateBGGTop50,
    doUpdateGamesForGeek,
    doUpdateMetadata,
    doUpdateProcessUserResult,
    doMarkGeekDoesNotExist,
    doUpdatePlaysForPeriod,
    doMarkPlaysUrlProcessed,
    doProcessDesignerResult,
    doProcessPublisherResult, doReprocessPlays, doRebuildMaterialisedViews, doMarkDesignerDoesNotExist,
    doMarkPublisherDoesNotExist
} from "./mysql-rds.mjs";
import { listAdd, sendMessage, sendToQueueWithDelay} from "./library.mjs";
import {loadSystem, System} from "./system.mjs";
import {flushLogging, initLogging, log} from "./logging.mjs";

dotenv.config({ path: ".env", quiet: true });


// Set the AWS Region.
const REGION = process.env.AWS_REGION;
// Create an Amazon S3 service client object.

async function main() {
    const system = await loadSystem();
    await initLogging(system, "InsideQueue");
    let slowdowns = 0;
    const sqsClient = new SQSClient({ region: REGION });
    // let lastTime = new Date().getTime();
    while (true) {
        // console.log(`... waiting for queue with ${slowdowns} slowdowns.`);
        // Credentials are granted to the EC2 hosting this so we don't need to add them here.
        const input: ReceiveMessageCommandInput = { QueueUrl: system.downloaderQueue, WaitTimeSeconds: 20, MaxNumberOfMessages: 10 };
        const command = new ReceiveMessageCommand(input);
        await flushLogging();
        const response = await sqsClient.send(command);
        if (response.Messages) {
            slowdowns += await handleMessages(system, sqsClient, response.Messages, system.downloaderQueue);
        }
        await flushLogging();
    }
    log("We terminated.");
    await flushLogging();
}

interface SQSMessage {
    receiptHandle: string;
    payload: QueueMessage | undefined;
    isSlowdown: boolean;
    discriminator: QueueMessage["discriminator"]
}

function processSQSMessage(message: Message): SQSMessage {
    const payload: QueueMessage | undefined = message.Body ? JSON.parse(message.Body) : undefined;
    return {
        receiptHandle: message.ReceiptHandle,
        payload,
        isSlowdown: payload && payload.discriminator === "SlowDownMessage",
        discriminator: payload.discriminator
    }
}

async function handleMessages(system: System, sqsClient: SQSClient, messages: Message[], queueUrl: string): Promise<number> {
    console.log(`${dateFormat("isoTime")}: Retrieved ${messages.length} messages from downloader queue`);
    const processedMessages = messages.map(processSQSMessage);
    // count the slowdowns
    const slowdowns = processedMessages.filter(m => m.isSlowdown).length;
    // coalesce the ensure games messages
    const ensures = processedMessages
        .filter(m => m.discriminator === "EnsureGamesMessage")
        .map(m => (m.payload as EnsureGamesMessage).gameIds);
    // make sure played games are in the database as well.
    const playeds: number[][] = processedMessages
        .filter(m => m.discriminator === "PlaysForPeriodResultMessage")
        .map(m => (m.payload as PlaysForPeriodResultMessage).plays.plays.filter(pd => !!pd).map(pd => pd.gameid));
    if (ensures.length > 0 || playeds.length > 0) {
        let ids: number[] | undefined;
        for (const e of ensures) {
            if (!ids) {
                ids = e;
            } else {
                listAdd(ids, e);
            }
        }
        for (const e of playeds) {
            if (!ids) {
                ids = e;
            } else {
                listAdd(ids, e);
            }
        }
        // console.log(`Coalesced ${ensures.length} ensure games messages ${playeds.length} played games messages : ${ids.length}`);
        await system.withConnectionAsync(conn => doEnsureGames(conn, ids));
    }
    // ack the ones we've done
    for (const message of processedMessages.filter(m => m.isSlowdown || m.discriminator === "EnsureGamesMessage")) {
        await sqsClient.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.receiptHandle }));
    }
    const ensureCount = processedMessages.filter(m =>  m.discriminator === "EnsureGamesMessage").length;
    await system.withConnectionAsync(async conn => {
        const sql = 'update counters set slowdowns = slowdowns + ?, downloader_processed = downloader_processed + ?';
        await conn.query(sql, [ slowdowns, ensureCount ]);
    });
    // process everything else one by one
    for (const message of processedMessages.filter(m => !m.isSlowdown && m.discriminator !== "EnsureGamesMessage")) {
        if (message.payload) {
            await handleQueueMessage(system, message.payload);
            await system.withConnectionAsync(async conn => {
                const sql = 'update counters set downloader_processed = downloader_processed + 1';
                await conn.query(sql);
            });
        } else {
            console.log("What is this?");
            console.log(JSON.stringify(message));
            await system.withConnectionAsync(async conn => {
                const sql = 'update counters set downloader_unknown = downloader_unknown + 1';
                await conn.query(sql);
            });
        }
        await sqsClient.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.receiptHandle }));
    }
    await flushLogging();
    return slowdowns;
}

function reportStats(discriminator: string, stats: RequestStats) {
    stats.received = new Date().getTime();
    console.log(`${discriminator}: INIT ${stats.downloaded - stats.initiated} DL ${stats.completed - stats.downloaded} COMP ${stats.received - stats.completed} RECV ${stats.received - stats.initiated} TOT`);
}

async function handleQueueMessage(system: System, message: QueueMessage) {
    switch (message.discriminator) {
        case "RebuildMaterialisedViews":
            console.log("RebuildMaterialisedViews");
            await system.withConnectionAsync(conn => doRebuildMaterialisedViews(conn));
            break;
        case "ReprocessPlays":
            console.log(`ReprocessPlays ${message.geek}`);
            await system.withConnectionAsync(conn => doReprocessPlays(conn, message.geek));
            await sendMessage(system, [message.geek], ["updates"], { message: "Finished reprocessing your plays."});
            break;
        case "CleanUpCollectionMessage":
            console.log(`CleanUpCollectionMessage ${message.params.geek} ${message.params.items.length}`);
            await system.withConnectionAsync(conn => doProcessCollectionCleanup(conn, message.params.geek, message.params.items, message.params.url));
            await sendMessage(system, [message.params.geek], ["updates"], { message: "Finished updating your collection."});
            break;
        case "CollectionResultMessage":
            reportStats(message.discriminator, message.result);
            if (message.result.geek === undefined) {
                console.log("Skipping that nonsense");
            } else {
                await system.withConnectionAsync(conn => doUpdateGamesForGeek(conn, message.result.geek, message.result.items));
            }
            break;
        case "GameResultMessage":
            reportStats(message.discriminator, message.result);
            await system.withConnectionAsync(conn => doProcessGameResult(conn, message.result));
            break;
        case "MarkAsProcessedMessage":
            console.log(JSON.stringify(message));
            await system.withConnectionAsync(conn => doMarkUrlProcessed(conn, message.fileDetails.processMethod as ProcessMethod, message.fileDetails.url));
            break;
        case "MarkAsTryAgainMessage":
            console.log(JSON.stringify(message));
            await system.withConnectionAsync(conn => doMarkUrlTryTomorrow(conn, message.fileDetails.processMethod, message.fileDetails.url));
            break;
        case "MarkAsUnprocessedMessage":
            console.log(`MarkAsUnprocessedMessage ${message.fileDetails.processMethod} ${message.fileDetails.geek}`)
            // await system.withConnectionAsync(conn => doMarkUrlUnprocessed(conn, message.fileDetails.processMethod, message.fileDetails.url));
            // reschedule while BGG has the data.
            const fd: FileToProcess = message.fileDetails;
            if (message.fileDetails.processMethod === "processCollection") {
                const toProcess: ToProcessElement = {
                    ...fd,
                    lastUpdate: null,
                    nextUpdate: null,
                    description: "",
                    lastattempt: null,
                    last_scheduled: null,
                    month: null,
                    year: null
                };
                await sendToQueueWithDelay(system.retryQueue, toProcess, 45);
            }
            break;
        case "MarkPlaysForPeriodProcessed":
            console.log(`MarkPlaysForPeriodProcessed ${message.url}`);
            await system.withConnectionAsync(conn => doMarkPlaysUrlProcessed(conn, message.url))
            break;
        case "NoSuchGameMessage":
            console.log(JSON.stringify(message));
            await system.withConnectionAsync(conn => doMarkGameDoesNotExist(conn, message.gameId));
            break;
        case "NoSuchGeekMessage":
            console.log(`NoSuchGeek ${message.geek}`);
            await system.withConnectionAsync(conn => doMarkGeekDoesNotExist(conn, message.geek));
            break;
        case "NoSuchDesignerMessage":
            console.log(`NoSuchDesigner ${message.bggId}`);
            await system.withConnectionAsync(conn => doMarkDesignerDoesNotExist(conn, message.bggId));
            break;
        case "NoSuchPublisherMessage":
            console.log(`NoSuchPublisher ${message.bggId}`);
            await system.withConnectionAsync(conn => doMarkPublisherDoesNotExist(conn, message.bggId));
            break;
        case "PlaysForPeriodResultMessage":
            console.log(`PlaysForPeriodResultMessage ${message.plays.geek} ${message.plays.startYmdInc} ${message.plays.endYmdInc} ${message.plays.plays.length}`);
            await system.withConnectionAsync(conn => doUpdatePlaysForPeriod(conn, message.plays));
            await sendMessage(system, [message.plays.geek], ["updates"], { message: `Updated your plays for ${message.plays.startYmdInc}-${message.plays.endYmdInc}`});
            break;
        case "UpdateMetadataMessage":
            console.log(JSON.stringify(message));
            await system.withConnectionAsync(conn => doUpdateMetadata(conn, message.metadata.series, message.metadata.rules));
            break;
        case "UpdateTop50Message":
            console.log(JSON.stringify(message));
            await system.withConnectionAsync(conn => doUpdateBGGTop50(conn, message.top50));
            break;
        case "UpdateUserListMessage":
            console.log("UpdateUserListMessage");
            await system.withConnectionAsync(conn => doEnsureUsers(conn, message.users));
            break;
        case "UserResultMessage":
            reportStats(message.discriminator, message.result);
            console.log(`UserResultMessage ${message.result.geek}`);
            await system.withConnectionAsync(conn =>
                doUpdateProcessUserResult(conn, message.result.geek, message.result.bggid, message.result.country, message.result.url));
            await sendMessage(system, [message.result.geek], ["updates"], { message: `Updated your geek info.`});
            break;
        case "DesignerResultMessage":
            reportStats(message.discriminator, message.result);
            console.log(`DesignerResultMessage ${message.result.name}`);
            await system.withConnectionAsync(conn => doProcessDesignerResult(conn, message.result));
            break;
        case "PublisherResultMessage":
            reportStats(message.discriminator, message.result);
            console.log(`PublisherResultMessage ${message.result.name}`);
            await system.withConnectionAsync(conn => doProcessPublisherResult(conn, message.result));
            break;
        default:
            // this should not happen
            const m = message as any;
            console.log(`=== ${message} not handled.`);
            if ("discriminator" in m) {
                log(`${m.discriminator} not handled.`);
            } else {
                log(`InsideQ got unknown ${JSON.stringify(m)}`);
            }
            break;
    }
}



main()
    .catch(err => console.log(err))
    .then(() => console.log("Done."))
    .catch(() => 'obligatory catch');

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
    PlaysToProcess,
    ProcessMethod,
    QueueMessage,
    ToProcessElement
} from "extstats-core";
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
    getGeeksThatDontExist, doUpdatePlaysForPeriod
} from "./mysql-rds.mjs";
import {invokeLambdaAsync, listAdd, sleep} from "./library.mjs";
import {loadSystem, System} from "./system.mjs";
import {flushLogging, initLogging, log} from "./logging.mjs";

const OUTSIDE_PREFIX = "downloader-";

// method names from the database - this is the type of thing we have to do.
const METHOD_PROCESS_USER = "processUser";
const METHOD_PROCESS_COLLECTION = "processCollection";
const METHOD_PROCESS_PLAYED = "processPlayed";
const METHOD_PROCESS_GAME = "processGame";
const METHOD_PROCESS_YEAR = "processYear";
const METHOD_PROCESS_DESIGNER = "processDesigner";
const METHOD_PROCESS_PUBLISHER = "processPublisher";

// lambda names we expect to see
const FUNCTION_PROCESS_USER = "processUser";
const FUNCTION_PROCESS_COLLECTION = "processCollection";
const FUNCTION_PROCESS_GAME = "processGame";
const FUNCTION_PROCESS_PLAYED = "processPlayed";
const FUNCTION_PROCESS_DESIGNER = "processDesigner";
const FUNCTION_PROCESS_PUBLISHER = "processPublisher";

dotenv.config({ path: ".env", quiet: true });


// Set the AWS Region.
const REGION = process.env.AWS_REGION;
// Create an Amazon S3 service client object.

async function main() {
    const system = await loadSystem();
    await initLogging(system, "InsideQueue");
    let slowdowns = 0;
    while (true) {
        console.log(`Waiting for queue ${system.downloaderQueue} with ${slowdowns} slowdowns.`);
        // Credentials are granted to the EC2 hosting this so we don't need to add them here.
        const sqsClient = new SQSClient({ region: REGION });
        const input: ReceiveMessageCommandInput = { QueueUrl: system.downloaderQueue, WaitTimeSeconds: 3, MaxNumberOfMessages: 10 };
        const command = new ReceiveMessageCommand(input);
        const response = await sqsClient.send(command);
        if (response.Messages) {
            slowdowns += await handleMessages(system, sqsClient, response.Messages, system.downloaderQueue);
            if (response.Messages.length < 2) {
                slowdowns -= await noMessages(system, 2 - response.Messages.length, slowdowns);
            }
        } else {
            console.log("No messages");
            slowdowns -= await noMessages(system, 10, slowdowns);
        }
        await flushLogging();
    }
    log("We terminated.");
    await flushLogging();
}

async function scheduleProcessing(system: System, element: ToProcessElement) {
    // TODO - invoke appropriate lambda
    if (element.processMethod === METHOD_PROCESS_USER) {
        console.log(`scheduling processUser ${element.geek}`);
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_USER, element);
    } else if (element.processMethod === METHOD_PROCESS_COLLECTION) {
        console.log(`scheduling processCollection ${element.geek}`);
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION, element);
    } else if (element.processMethod === METHOD_PROCESS_PLAYED) {
        console.log(`* updating played years for ${element.geek}`);
        await updatePlayedYears(system, element.geek, element.geekid, element.id);
    } else if (element.processMethod === METHOD_PROCESS_GAME) {
        console.log(`scheduling processGame ${element.bggid}`);
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_GAME, element);
    } else if (element.processMethod === METHOD_PROCESS_YEAR) {
        const fs = element.url.split("=");
        const p2p = {
            url: element.url,
            processMethod: METHOD_PROCESS_YEAR,
            geek: element.geek,
            geekid: element.geekid,
            startYmdInc: fs[0],
            endYmdInc: fs[1]
        } as PlaysToProcess;
        console.log(`scheduling processYear ${element.url}`);
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_PLAYED, p2p);
    } else if (element.processMethod === METHOD_PROCESS_DESIGNER) {
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_DESIGNER, element);
    } else if (element.processMethod === METHOD_PROCESS_PUBLISHER) {
        await invokeLambdaAsync(OUTSIDE_PREFIX + FUNCTION_PROCESS_PUBLISHER, element);
    }
}

async function updatePlayedYears(system: System, geek: string, geekid: number, fileId: number) {
    const sql = "delete from files where processMethod = 'processPlays' and geek = ?";
    await system.withConnectionAsync(conn => conn.query(sql, [ geek ]));
    const thisYear = (new Date()).getFullYear();

    const periods = [
        { start: "0000-0-0", end: "1979-12-31" },
        { start: "1980-0-0", end: "1989-12-31" },
        { start: "1990-0-0", end: "1999-12-31" },
    ];
    let y = 2000;
    while (y <= thisYear) {
        periods.push({ start: `${y}-0-0`, end: `${y}-12-31` });
        y++;
    }
    const q = "select url from files where processMethod = 'processYear' and geekid = ?";
    const index = await system.returnWithConnection(async conn => {
        return [...await conn.query(q, [geekid])];
    });
    for (const p of periods) {
        const range = `${p.start}=${p.end}=${geek}`;
        if (index.includes(range)) continue;
        const insertSql = "insert into files (url, processMethod, geek, geekid, lastupdate, tillNextUpdate, description, bggid) values (?, ?, ?, ?, ?, ?, ?, ?)";
        const insertParams = [range, "processYear", geek, geekid, null, null, `Plays from ${p.start} until ${p.end}`, 0];
        await system.withConnectionAsync(async conn => await conn.query(insertSql, insertParams));
    }
    const nextUpdate = new Date();
    nextUpdate.setFullYear(thisYear + 1);
    nextUpdate.setMonth(0);
    nextUpdate.setDate(2);
    const updateSql = "update files set nextUpdate = ?, lastUpdate = ? where id = ?";
    const updateParams = [ nextUpdate, new Date(), fileId ];
    await system.withConnectionAsync(async conn => await conn.query(updateSql, updateParams));
}

// return how many slowdowns we ate up
async function noMessages(system: System, howManyToDo: number, slowDowns: number): Promise<number> {
    let eaten = 0;
    if (slowDowns > 0) {
        const toDo = Math.min(slowDowns, 5);
        eaten = toDo;
        console.log(`... sleeping for ${toDo} seconds due to ${slowDowns} slowdowns`);
        slowDowns -= eaten;
        await sleep(toDo * 1000);
    }
    if (slowDowns >= howManyToDo) return (eaten + howManyToDo);
    howManyToDo -= slowDowns;
    eaten += slowDowns;
    const geeksThatDontExist = await system.returnWithConnection(getGeeksThatDontExist);
    // TODO - allow a variety of types
    const todo: ToProcessElement[] =
        await system.returnWithConnection(conn =>
            doListToProcess(conn, howManyToDo, ["processUser", "processCollection", "processGame", "processPlayed", "processYear"], true))
    for (const element of todo) {
        if (!!element.geek && geeksThatDontExist.includes(element.geek)) {
            // this shouldn't happen.
            log(`Geek ${element.geek} doesn't even exist.`);
            await system.withConnectionAsync(conn => doMarkUrlProcessed(conn, element.processMethod as ProcessMethod, element.url));
        } else {
            await scheduleProcessing(system, element);
        }
    }
    return eaten;
}

interface SQSMessage {
    receiptHandle: string;
    payload: QueueMessage | undefined;
    isSlowdown: boolean;
    discriminator: QueueMessage["discriminator"]
}

function processSQSMessage(message: Message): SQSMessage {
    const payload: QueueMessage | undefined = message.Body ? JSON.parse(message.Body) : undefined
    return {
        receiptHandle: message.ReceiptHandle,
        payload,
        isSlowdown: payload && payload.discriminator === "SlowDownMessage",
        discriminator: payload.discriminator
    }
}

async function handleMessages(system: System, sqsClient: SQSClient, messages: Message[], queueUrl: string): Promise<number> {
    console.log(`Retrieved ${messages.length} messages from downloader queue`);
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
        .map(m => (m.payload as PlaysForPeriodResultMessage).plays.plays.map(pd => pd.gameid));
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
        console.log(`Coalesced ${ensures.length} ensure games messages ${playeds.length} played games messages : ${ids.length}`);
        await system.withConnectionAsync(conn => doEnsureGames(conn, ids));
    }
    // ack the ones we've done
    for (const message of processedMessages.filter(m => m.isSlowdown || m.discriminator === "EnsureGamesMessage")) {
        await sqsClient.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.receiptHandle }));
    }
    // process everything else one by one
    for (const message of processedMessages.filter(m => !m.isSlowdown && m.discriminator !== "EnsureGamesMessage")) {
        if (message.payload) {
            await handleQueueMessage(system, message.payload);
        } else {
            console.log("What is this?");
            console.log(JSON.stringify(message));
        }
        await sqsClient.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.receiptHandle }));
    }
    await flushLogging();
    return slowdowns;
}

async function handleQueueMessage(system: System, message: QueueMessage) {
    switch (message.discriminator) {
        case "CleanUpCollectionMessage":
            console.log(`CleanUpCollectionMessage ${message.params.geek} ${message.params.items.length}`);
            await system.withConnectionAsync(conn => doProcessCollectionCleanup(conn, message.params.geek, message.params.items, message.params.url));
            break;
        case "CollectionResultMessage":
            console.log(`CollectionResultMessage ${message.result.geek} ${message.result.items.length}`);
            await system.withConnectionAsync(conn => doUpdateGamesForGeek(conn, message.result.geek, message.result.items));
            break;
        // case "EnsureGamesMessage":
        //     console.log(`EnsureGamesMessage ${message.gameIds.length}`);
        //     await system.withConnectionAsync(conn => doEnsureGames(conn, message.gameIds));
        //     break;
        case "GameResultMessage":
            console.log(`GameResultMessage ${message.result.name}`);
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
            await system.withConnectionAsync(conn => doMarkUrlUnprocessed(conn, message.fileDetails.processMethod, message.fileDetails.url));
            // reschedule while BGG has the data.
            const fd: FileToProcess = message.fileDetails;
            if (message.fileDetails.processMethod === "processCollection") {
                console.log(`* rescheduling processCollection for ${fd.geek}`);
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
                setTimeout(() => scheduleProcessing(system, toProcess), 60);
            }
            break;
        case "NoSuchGameMessage":
            console.log(JSON.stringify(message));
            await system.withConnectionAsync(conn => doMarkGameDoesNotExist(conn, message.gameId));
            break;
        case "NoSuchGeekMessage":
            console.log(`NoSuchGeek ${message.geek}`);
            await system.withConnectionAsync(conn => doMarkGeekDoesNotExist(conn, message.geek));
            break;
        case "PlayedResultMessage":
            console.log(JSON.stringify(message));
            await system.withConnectionAsync(conn => doProcessPlayedMonths(conn, message.monthsData.geek, message.monthsData.monthsPlayed, message.monthsData.url));
            break;
        case "PlaysResultMessage":
            console.log(JSON.stringify(message));
            await system.withConnectionAsync(conn => doProcessPlaysResult(conn, message.result));
            break;
        case "PlaysForPeriodResultMessage":
            console.log(`PlaysForPeriodResultMessage ${message.plays.geek} ${message.plays.startYmdInc} ${message.plays.endYmdInc} ${message.plays.plays.length}`);
            await system.withConnectionAsync(conn => doUpdatePlaysForPeriod(conn, message.plays));
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
            console.log(`UserResultMessage ${message.result.geek}`);
            await system.withConnectionAsync(conn =>
                doUpdateProcessUserResult(conn, message.result.geek, message.result.bggid, message.result.country, message.result.url));
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
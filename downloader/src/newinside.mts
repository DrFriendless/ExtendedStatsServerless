import {isHttpResponse} from "./system.mjs";
import {InsideSystem, loadInsideSystem} from "./insidesystem.mjs";
import {
    doEnsureGames,
    doEnsureUsers,
    doListToProcess, doMarkDesignerDoesNotExist, doMarkGameDoesNotExist, doMarkGeekDoesNotExist,
    doMarkPlaysUrlProcessed,
    doMarkPublisherDoesNotExist,
    doMarkUrlProcessed, doMarkUrlTryTomorrow, doProcessCollectionCleanup, doProcessDesignerResult,
    doProcessGameResult, doProcessPublisherResult, doRebuildMaterialisedViews, doRecordGameExpansions, doReprocessPlays,
    doUpdateBGGTop50, doUpdateGamesForGeek,
    doUpdateLastScheduledForUrls, doUpdateMetadata, doUpdatePlaysForPeriod, doUpdateProcessUserResult,
    getGeekId,
    getGeeksThatDontExist
} from "./mysql-rds.mjs";
import {
    AbstractDownloadRequest,
    EnsureGamesMessage,
    FileToProcess,
    ProcessMethod,
    QueueMessage,
    RequestStats,
    ToProcessElement,
    UpdatePlayedYearsResult
} from "./interfaces.mjs";
import {listAdd} from "./library.mjs";

// method names from the database - this is the type of thing we have to do.
const METHOD_PROCESS_COLLECTION = "processCollection";
const METHOD_PROCESS_PLAYED = "processPlayed";

// Lambda handler
export async function handleWriteResult(event: { Records: { body: string, receiptHandle: string }[] }) {
    const system = await loadInsideSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }

    const bodies: QueueMessage[] = event.Records.map(e => JSON.parse(e.body));
    const ensures = bodies
        .filter(m => m.discriminator === "EnsureGamesMessage")
        .map(m => m.gameIds);
    // make sure played games are in the database as well.
    const playeds: number[][] = bodies
        .filter(m => m.discriminator === "PlaysForPeriodResultMessage")
        .map(m => m.plays.plays.filter(pd => !!pd).map(pd => pd.gameid));
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
        await system.asyncReturnWithConnection(async conn => await doEnsureGames(conn, ids));
        if (ensures.length > 0) {
            await system.asyncWithConnection(async conn => {
                const sql = 'update counters set downloader_processed = downloader_processed + ?';
                await conn.query(sql, [ensures.length]);
            });
        }
    }

    for (const record of bodies) {
        if (record.discriminator !== "EnsureGamesMessage") {
            console.log(JSON.stringify(record));
            await handleQueueMessage(system, record);
            await system.asyncWithConnection(async conn => {
                const sql = 'update counters set downloader_processed = downloader_processed + 1';
                await conn.query(sql);
            });
        }
    }
}

async function writePlayedYears(system: InsideSystem, event: UpdatePlayedYearsResult) {
    const sql = "delete from files where processMethod = 'processPlays' and geek = ?";
    await system.asyncWithConnection(conn => conn.query(sql, [ event.geek ]));
    const geekid: number = await system.asyncReturnWithConnection(async conn => await getGeekId(conn, event.geek));

    // existing date URLs.
    const index = (await system.asyncReturnWithConnection(async conn => {
        return [...await conn.query("select trim(url) u from files where processMethod = 'processYear' and geek = ?", [event.geek])] as { u: string }[];
    })).map(row => row.u);
    for (const p of event.periods) {
        const range = `${p.start}=${p.end}=${event.geek}`;
        if (index.indexOf(range) >= 0) continue;
        const year = parseInt(p.start.substring(0, 4));
        const insertSql = "insert into files (url, processMethod, geek, geekid, lastupdate, tillNextUpdate, description, bggid, year) values (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        const insertParams = [range, "processYear", event.geek, geekid, null, null, `Plays from ${p.start} until ${p.end}`, 0, year];
        await system.asyncWithConnection(async conn => await conn.query(insertSql, insertParams));
    }

    const updateSql = "update files set nextUpdate = ?, lastUpdate = ?, geekid = ? where id = ?";
    const updateParams = [ event.nextUpdate, new Date(), geekid, event.fileId ];
    await system.asyncWithConnection(async conn => await conn.query(updateSql, updateParams));
}

// Lambda entry point - invoked periodically to see if the downloader has anything to do.
export async function handleStartTasks(event: any): Promise<any> {
    const system = await loadInsideSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }
    return await startTasks(system);
}

async function startTasks(system: InsideSystem): Promise<any> {
    let howManyToDo = 9;
    console.log(`startTasks ${howManyToDo}`);

    // check for things on the retry queue - these have already been through prehandle.
    const retried: AbstractDownloadRequest[] = await system.receiveFromRetry();
    if (retried && retried.length > 0) {
        for (const m of retried) {
            howManyToDo--;
            await system.sendToFifoQueueWithDelay(system.inputQueue, m, 0, "retry");
        }
    }
    if (howManyToDo <= 0) return;

    const geeksThatDontExist = await system.asyncReturnWithConnection(getGeeksThatDontExist);
    const todo: ToProcessElement[] =
        await system.asyncReturnWithConnection(conn =>
            doListToProcess(conn, howManyToDo, ["processUser", "processCollection", "processGame", "processPlayed", "processYear", "processDesigner", "processPublisher"]));
    // console.log(JSON.stringify(todo));
    const batch: ToProcessElement[] = [];
    const throttle: ProcessMethod[] = [];
    let collectionCount = 0;
    for (const element of todo) {
        if (!!element.geek && geeksThatDontExist.includes(element.geek)) {
            // this shouldn't happen.
            // console.log(`Geek ${element.geek} doesn't even exist.`);
            await system.asyncWithConnection(conn => doMarkUrlProcessed(conn, element.processMethod as ProcessMethod, element.url));
        } else {
            if (element.processMethod === METHOD_PROCESS_PLAYED) {
                if (throttle.indexOf(element.processMethod as ProcessMethod) < 0) {
                    batch.push(element);
                    throttle.push(element.processMethod as ProcessMethod);
                } else {
                    // console.log(`Throttled ${element.processMethod} ${element.url}`);
                }
            } else if (element.processMethod === METHOD_PROCESS_COLLECTION) {
                if (collectionCount >= 2) {
                    // console.log(`Throttled ${element.processMethod} ${element.url}`);
                } else {
                    batch.push(element);
                    collectionCount++;
                }
            } else {
                batch.push(element);
            }
        }
    }
    console.log(JSON.stringify(batch));
    if (batch.length === 0) {
        return [];
    } else {
        await system.asyncWithConnection(async conn => await doUpdateLastScheduledForUrls(conn, batch.map(element => element.url)));
        return batch;
    }
}

async function handleQueueMessage(system: InsideSystem, message: QueueMessage) {
    switch (message.discriminator) {
        case "RebuildMaterialisedViews":
            console.log("RebuildMaterialisedViews");
            await system.asyncWithConnection(conn => doRebuildMaterialisedViews(conn));
            break;
        case "ReprocessPlays":
            console.log(`ReprocessPlays ${message.geek}`);
            await system.asyncWithConnection(conn => doReprocessPlays(conn, message.geek));
            await system.sendMessage([message.geek], ["updates"], { message: "Finished reprocessing your plays."});
            break;
        case "CleanUpCollectionMessage":
            console.log(`CleanUpCollectionMessage ${message.params.geek} ${message.params.items.length}`);
            await system.asyncWithConnection(conn => doProcessCollectionCleanup(conn, message.params.geek, message.params.items, message.params.url));
            await system.sendMessage([message.params.geek], ["updates"], { message: "Finished updating your collection."});
            break;
        case "CollectionResultMessage":
            reportStats(message.discriminator, message.result);
            if (message.result.geek === undefined) {
                console.log("Skipping that nonsense");
            } else {
                await system.asyncWithConnection(conn => doUpdateGamesForGeek(conn, message.result.geek, message.result.items));
            }
            break;
        case "GameResultMessage":
            reportStats(message.discriminator, message.result);
            await system.asyncWithConnection(conn => doProcessGameResult(conn, message.result));
            break;
        case "MarkAsProcessedMessage":
            console.log(JSON.stringify(message));
            await system.asyncWithConnection(conn => doMarkUrlProcessed(conn, message.fileDetails.processMethod as ProcessMethod, message.fileDetails.url));
            break;
        case "MarkAsTryAgainMessage":
            console.log(JSON.stringify(message));
            await system.asyncWithConnection(conn => doMarkUrlTryTomorrow(conn, message.fileDetails.processMethod, message.fileDetails.url));
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
                await system.sendToFifoQueueWithDelay(system.inputQueue, toProcess, 5, "processCollection");
            }
            break;
        case "MarkPlaysForPeriodProcessed":
            console.log(`MarkPlaysForPeriodProcessed ${message.url}`);
            await system.asyncWithConnection(conn => doMarkPlaysUrlProcessed(conn, message.url))
            break;
        case "NoSuchGameMessage":
            console.log(JSON.stringify(message));
            await system.asyncWithConnection(conn => doMarkGameDoesNotExist(conn, message.gameId));
            break;
        case "NoSuchGeekMessage":
            console.log(`NoSuchGeek ${message.geek}`);
            await system.asyncWithConnection(conn => doMarkGeekDoesNotExist(conn, message.geek));
            break;
        case "NoSuchDesignerMessage":
            console.log(`NoSuchDesigner ${message.bggId}`);
            await system.asyncWithConnection(conn => doMarkDesignerDoesNotExist(conn, message.bggId));
            break;
        case "NoSuchPublisherMessage":
            console.log(`NoSuchPublisher ${message.bggId}`);
            await system.asyncWithConnection(conn => doMarkPublisherDoesNotExist(conn, message.bggId));
            break;
        case "PlaysForPeriodResultMessage":
            console.log(`PlaysForPeriodResultMessage ${message.plays.geek} ${message.plays.startYmdInc} ${message.plays.endYmdInc} ${message.plays.plays.length}`);
            await system.asyncWithConnection(conn => doUpdatePlaysForPeriod(conn, message.plays));
            await system.sendMessage([message.plays.geek], ["updates"], { message: `Updated your plays for ${message.plays.startYmdInc}-${message.plays.endYmdInc}`});
            break;
        case "UpdateMetadataMessage":
            console.log(JSON.stringify(message));
            await system.asyncWithConnection(conn => doUpdateMetadata(conn, message.metadata.series, message.metadata.rules));
            break;
        case "UpdateTop50Message":
            console.log(JSON.stringify(message));
            await system.asyncWithConnection(conn => doUpdateBGGTop50(conn, message.top50));
            break;
        case "UpdateUserListMessage":
            console.log("UpdateUserListMessage");
            await system.asyncWithConnection(conn => doEnsureUsers(conn, message.users));
            break;
        case "UserResultMessage":
            reportStats(message.discriminator, message.result);
            console.log(`UserResultMessage ${message.result.geek}`);
            await system.asyncWithConnection(conn =>
                doUpdateProcessUserResult(conn, message.result.geek, message.result.bggid, message.result.country, message.result.url));
            await system.sendMessage([message.result.geek], ["updates"], { message: `Updated your geek info.`});
            break;
        case "DesignerResultMessage":
            reportStats(message.discriminator, message.result);
            console.log(`DesignerResultMessage ${message.result.name}`);
            await system.asyncWithConnection(conn => doProcessDesignerResult(conn, message.result));
            break;
        case "PublisherResultMessage":
            reportStats(message.discriminator, message.result);
            console.log(`PublisherResultMessage ${message.result.name}`);
            await system.asyncWithConnection(conn => doProcessPublisherResult(conn, message.result));
            break;
        default:
            // this should not happen
            const m = message as any;
            console.log(`=== ${message} not handled.`);
            if ("discriminator" in m) {
                console.log(`${m.discriminator} not handled.`);
            } else {
                console.log(`InsideQ got unknown ${JSON.stringify(m)}`);
            }
            break;
    }

    function reportStats(discriminator: string, stats: RequestStats) {
        stats.received = new Date().getTime();
        console.log(`${discriminator}: INIT ${stats.downloaded - stats.initiated} DL ${stats.completed - stats.downloaded} COMP ${stats.received - stats.completed} RECV ${stats.received - stats.initiated} TOT`);
    }
}


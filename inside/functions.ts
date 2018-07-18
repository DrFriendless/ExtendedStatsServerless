import {Callback} from 'aws-lambda';
import {
    doNormalisePlaysForMonth,
    doSetGeekPlaysForMonth,
    ensureGames, ensureMonthsPlayed, ensurePlaysGames, ensureProcessPlaysFiles,
    ensureUsers, getGeekId,
    listToProcess,
    listToProcessByMethod, loadExpansionData,
    markGameDoesNotExist,
    markUrlProcessed, markUrlProcessedWithUpdate, markUrlTryTomorrow,
    markUrlUnprocessed, recordGameExpansions,
    restrictCollectionToGames,
    updateFrontPageGeek,
    updateGame,
    updateGamesForGeek,
    updateLastScheduledForUrls,
    updateUserValues
} from "./mysql-rds";
import {
    CleanUpCollectionResult,
    FileToProcess,
    ProcessCollectionResult,
    ProcessGameResult, ProcessMonthsPlayedResult, ProcessPlaysResult,
    ProcessUserResult
} from "./interfaces";
import {getConnection, promiseToCallback} from "./library";


export async function processGameResult(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    console.log(event);
    const data = event as ProcessGameResult;
    try {
        await updateGame(data);
        await recordGameExpansions(data.gameId, data.expansions);
        await markUrlProcessed("processGame", data.url);
        callback(null, null);
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

export async function processUserResult(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const data = event as ProcessUserResult;
    try {
        await updateUserValues(data.geek, data.bggid, data.country);
        await markUrlProcessed("processUser", data.url);
        callback(null, null);
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

// Lambda to receive the list of users from processUserList and make sure they are all in the database
export async function updateUserList(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const body = event as string;
    const usernames = body.split(/\r?\n/);
    console.log("checking for " + usernames.length + " users");
    try {
        await ensureUsers(usernames);
        callback(null, null);
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

// Lambda to retrieve some number of files that need processing
export function getToProcessList(event, context, callback: Callback) {
    // updateLastScheduled cannot be set from the URL
    context.callbackWaitsForEmptyEventLoop = false;
    const countParam = (event.query && event.query.count) || event.count;
    let count = parseInt(countParam);
    if (!count || count < 1 || count > 1000) count = 10;
    let query;
    if (event.processMethod) {
        query = listToProcessByMethod(count, event.processMethod);
    } else {
        query =  listToProcess(count);
    }
    const promise = query
        .then(elements => {
            const urls = elements.map(row => row.url);
            if (event.updateLastScheduled) {
                return updateLastScheduledForUrls(urls).then(() => elements);
            } else {
                return Promise.resolve(elements);
            }
        });
    promiseToCallback(promise, callback);
}

export async function processCollectionCleanup(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as CleanUpCollectionResult;
    console.log("processCollectionCleanup");
    try {
        await restrictCollectionToGames(params.geek, params.items);
        await markUrlProcessed("processCollection", params.url);
        await updateFrontPageGeek(params.geek);
        callback(null, null);
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

export async function processCollectionUpdateGames(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
   const params = event as ProcessCollectionResult;
   try {
       await ensureGames(params.items);
       await updateGamesForGeek(params.geek, params.items);
       callback(null, null);
   } catch (e) {
       console.log(e);
       callback(e);
   }
}

export async function processPlayedMonths(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as ProcessMonthsPlayedResult;
    try {
        await ensureMonthsPlayed(params.geek, params.monthsPlayed);
        await ensureProcessPlaysFiles(params.geek, params.monthsPlayed);
        await markUrlProcessed("processPlayed", params.url);
        callback(null, null);
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

export async function processPlaysResult(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as ProcessPlaysResult;
    console.log(params);
    try {
        const gameIds = [];
        for (const play of params.plays) {
            if (gameIds.indexOf(play.gameid) < 0) gameIds.push(play.gameid);
        }
        const conn = await getConnection();
        const geekId = await getGeekId(conn, params.geek);
        const expansionData = await loadExpansionData(conn);
        await ensurePlaysGames(gameIds);
        await doSetGeekPlaysForMonth(conn, geekId, params.month, params.year, params.plays);
        await doNormalisePlaysForMonth(conn, geekId, params.month, params.year, expansionData);
        const now = new Date();
        const nowMonth = now.getFullYear() * 12 + now.getMonth();
        const thenMonth = params.year * 12 + params.month;
        let delta;
        if (nowMonth - thenMonth > 6) {
            delta = '838:00:00';
        } else if (nowMonth - thenMonth > 2) {
            delta = '168:00:00';
        } else {
            delta = '72:00:00';
        }
        await markUrlProcessedWithUpdate("processPlays", params.url, delta);
        console.log("processPlaysResult success");
        callback(null, null);
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

export async function updateUrlAsProcessed(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as FileToProcess;
    try {
        await markUrlProcessed(params.processMethod, params.url);
        callback(null, null);
    } catch (e) {
        callback(e);
    }
}

export async function updateUrlAsUnprocessed(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as FileToProcess;
    try {
        await markUrlUnprocessed(params.processMethod, params.url);
        callback(null, null);
    } catch (e) {
        callback(e);
    }
}

export async function updateUrlAsTryTomorrow(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as FileToProcess;
    try {
        await markUrlTryTomorrow(params.processMethod, params.url);
        callback(null, null);
    } catch (e) {
        callback(e);
    }
}

export async function updateGameAsDoesNotExist(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await markGameDoesNotExist(event.bggid);
        callback(null, null);
    } catch (e) {
        callback(e);
    }
}

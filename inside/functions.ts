// Lambda functions
// Functions in this file are responsible for marshalling data in and out and dealing with the callback.
// Functions in this file may not access a database connection.

import {Callback} from 'aws-lambda';
import {
    CleanUpCollectionResult,
    FileToProcess, Metadata,
    ProcessCollectionResult,
    ProcessGameResult, ProcessMonthsPlayedResult, ProcessPlaysResult,
    ProcessUserResult
} from './interfaces';
import {getConnection} from './library';
import {
    runEnsureGames,
    runEnsureUsers,
    runListToProcess,
    runMarkGameDoesNotExist,
    runMarkUrlProcessed,
    runMarkUrlTryTomorrow,
    runMarkUrlUnprocessed, runProcessCollectionCleanup,
    runProcessGameResult,
    runProcessPlayedMonths,
    runProcessPlaysResult,
    runProcessUserResult,
    runUpdateGamesForGeek, runUpdateMetadata, runUpdateRankings, runUpdateBGGTop50
} from './service';


export async function processGameResult(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const data = event as ProcessGameResult;
    try {
        await runProcessGameResult(data);
        callback();
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

export async function processUserResult(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const data = event as ProcessUserResult;
    try {
        await runProcessUserResult(data.geek, data.bggid, data.country, data.url);
        callback();
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
    console.log('checking for ' + usernames.length + ' users');
    try {
        await runEnsureUsers(usernames);
        callback();
    } catch (e) {
        console.log(e);
        callback(e);
    }
    console.log("updateUserList complete");
}

export async function updateMetadata(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const body = event as Metadata;
    try {
        await runUpdateMetadata(body.series, body.rules);
        callback();
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

export async function updateBGGTop50(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const body = event as number[];
    try {
        await runUpdateBGGTop50(body);
        callback();
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

// Lambda to retrieve some number of files that need processing
export async function getToProcessList(event, context, callback: Callback) {
    // updateLastScheduled cannot be set from the URL
    context.callbackWaitsForEmptyEventLoop = false;
    const countParam = (event.query && event.query.count) || event.count;
    let count = parseInt(countParam);
    if (!count || count < 1 || count > 1000) count = 10;
    try {
        const result = await runListToProcess(count, event.processMethod, event.updateLastScheduled);
        callback(undefined, result);
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

export async function processCollectionCleanup(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as CleanUpCollectionResult;
    try {
        await runProcessCollectionCleanup(params.geek, params.items, params.url);
        callback();
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

export async function processCollectionUpdateGames(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as ProcessCollectionResult;
    try {
        // this has been added to Express as method ensuregames.
        // The caller should call that before calling this (or this will fail.)
        // This was because processCollectionUpdateGames took way too long to run.
        // await runEnsureGames(params.items);
        await runUpdateGamesForGeek(params.geek, params.items);
        callback();
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

export async function processPlayedMonths(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as ProcessMonthsPlayedResult;
    try {
        await runProcessPlayedMonths(params.geek, params.monthsPlayed, params.url);
        callback();
    } catch (e) {
        console.log(e);
        callback(e);
    }
}

export async function processPlaysResult(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as ProcessPlaysResult;
    const conn = await getConnection();
    try {
        await runProcessPlaysResult(params);
        callback();
    } catch (e) {
        console.log(e);
        callback(e);
    } finally {
        if (conn) conn.destroy();
    }
}

export async function updateUrlAsProcessed(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as FileToProcess;
    try {
        await runMarkUrlProcessed(params.processMethod, params.url);
        callback();
    } catch (e) {
        callback(e);
    }
}

export async function updateUrlAsUnprocessed(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as FileToProcess;
    try {
        await runMarkUrlUnprocessed(params.processMethod, params.url);
        callback();
    } catch (e) {
        callback(e);
    }
}

export async function updateUrlAsTryTomorrow(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as FileToProcess;
    try {
        await runMarkUrlTryTomorrow(params.processMethod, params.url);
        callback();
    } catch (e) {
        callback(e);
    }
}

export async function updateGameAsDoesNotExist(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runMarkGameDoesNotExist(event.bggid);
        callback();
    } catch (e) {
        callback(e);
    }
}

export async function updateRankings(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runUpdateRankings();
        callback();
    } catch (e) {
        callback(e);
    }
}

// Lambda functions
// Functions in this file are responsible for marshalling data in and out and dealing with the callback.
// Functions in this file may not access a database connection.

import { Callback, Context } from 'aws-lambda';
import {
    CleanUpCollectionResult,
    FileToProcess, Metadata,
    ProcessCollectionResult,
    ProcessGameResult, ProcessMonthsPlayedResult, ProcessPlaysResult,
    ProcessUserResult
} from './src/interfaces';
import {
    runEnsureUsers, recordError,
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
} from './src/service';


export async function processGameResult(event: ProcessGameResult, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runProcessGameResult(event);
        callback();
    } catch (e) {
        console.log(e);
        errorCallback(callback, e);
    }
}

export async function processUserResult(event: ProcessUserResult, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runProcessUserResult(event.geek, event.bggid, event.country, event.url);
        callback();
    } catch (e) {
        console.log(e);
        errorCallback(callback, e);
    }
}

// Lambda to receive the list of users from processUserList and make sure they are all in the database
export async function updateUserList(event: string, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const usernames = event.split(/\r?\n/);
    console.log('checking for ' + usernames.length + ' users');
    try {
        await runEnsureUsers(usernames);
        callback();
    } catch (e) {
        console.log(e);
        errorCallback(callback, e);
    }
    console.log("updateUserList complete");
}

export async function updateMetadata(event: Metadata, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runUpdateMetadata(event.series, event.rules);
        callback();
    } catch (e) {
        console.log(e);
        errorCallback(callback, e);
    }
}

export async function updateBGGTop50(event: number[], context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runUpdateBGGTop50(event);
        callback();
    } catch (e) {
        console.log(e);
        errorCallback(callback, e);
    }
}

interface ToProcessQuery {
    query? : {
        count: string;
    }
    count : string;
    processMethod: string;
    updateLastScheduled: boolean;
}

// Lambda to retrieve some number of files that need processing
export async function getToProcessList(event: ToProcessQuery, context: Context, callback: Callback) {
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
        errorCallback(callback, e);
    }
}

export async function processCollectionCleanup(event: CleanUpCollectionResult, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runProcessCollectionCleanup(event.geek, event.items, event.url);
        callback();
    } catch (e) {
        console.log(e);
        errorCallback(callback, e);
    }
}

export async function processCollectionUpdateGames(event: ProcessCollectionResult, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        // this has been added to Express as method ensuregames.
        // The caller should call that before calling this (or this will fail.)
        // This was because processCollectionUpdateGames took way too long to run.
        // await runEnsureGames(params.items);
        await runUpdateGamesForGeek(event.geek, event.items);
        callback();
    } catch (e) {
        console.log(e);
        errorCallback(callback, e);
    }
}

export async function processPlayedMonths(event: ProcessMonthsPlayedResult, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runProcessPlayedMonths(event.geek, event.monthsPlayed, event.url);
        callback();
    } catch (e) {
        console.log(e);
        errorCallback(callback, e);
    }
}

export async function processPlaysResult(event: ProcessPlaysResult, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runProcessPlaysResult(event);
        callback();
    } catch (e) {
        console.log(e);
        errorCallback(callback, e);
    }
}

export async function updateUrlAsProcessed(event: FileToProcess, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runMarkUrlProcessed(event.processMethod, event.url);
        callback();
    } catch (e) {
        errorCallback(callback, e);
    }
}

export async function updateUrlAsUnprocessed(event: FileToProcess, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runMarkUrlUnprocessed(event.processMethod, event.url);
        callback();
    } catch (e) {
        errorCallback(callback, e);
    }
}

export async function updateUrlAsTryTomorrow(event: FileToProcess, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runMarkUrlTryTomorrow(event.processMethod, event.url);
        callback();
    } catch (e) {
        errorCallback(callback, e);
    }
}

export async function updateGameAsDoesNotExist(event: { bggid: number }, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runMarkGameDoesNotExist(event.bggid);
        callback();
    } catch (e) {
        errorCallback(callback, e);
    }
}

export async function updateRankings(event: undefined, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await runUpdateRankings();
        callback();
    } catch (e) {
        errorCallback(callback, e);
    }
}

export async function logError(event: { message: string, source: string }, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        await recordError(event.message, event.source);
        callback();
    } catch (e) {
        errorCallback(callback, e);
    }
}

function errorCallback(callback: Callback, e: any) {
    if (typeof e === 'string' || e instanceof Error || e === null || e === undefined) {
        callback(e);
    } else {
        console.log(`safeCallback ${e}`)
    }
}

import {Callback} from 'aws-lambda';
import {
    ensureGames,
    ensureUsers,
    listToProcess,
    listToProcessByMethod,
    markGameDoesNotExist,
    markUrlProcessed,
    markUrlUnprocessed,
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
    ProcessGameResult,
    ProcessUserResult, WarTableRow
} from "./interfaces";
import {promiseToCallback} from "./library";


export function processGameResult(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    console.log(event);
    const data = event as ProcessGameResult;
    const promise = updateGame(data)
        .then(() => markUrlProcessed("processGame", data.url));
    promiseToCallback(promise, callback);
}

export function processUserResult(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    console.log(event);
    const data = event as ProcessUserResult;
    const promise = updateUserValues(data.geek, data.bggid, data.country)
        .then(() => markUrlProcessed("processUser", data.url));
    promiseToCallback(promise, callback);
}

// Lambda to receive the list of users from processUserList and make sure they are all in the database
export function updateUserList(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const body = event as string;
    const usernames = body.split(/\r?\n/);
    console.log("checking for " + usernames.length + " users");
    promiseToCallback(ensureUsers(usernames), callback);
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
    console.log(params);
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
   console.log(params);
   try {
       await ensureGames(params.items);
       await updateGamesForGeek(params.geek, params.items);
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
    } catch (e) {
        callback(e);
    }
}

export function updateUrlAsUnprocessed(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    const params = event as FileToProcess;
    promiseToCallback(markUrlUnprocessed(params.processMethod, params.url), callback);
}

export function updateGameAsDoesNotExist(event, context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    console.log(event);
    const bggid = event.bggid;
    promiseToCallback(markGameDoesNotExist(bggid), callback);
}

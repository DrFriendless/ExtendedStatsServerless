import {Callback} from 'aws-lambda';
import {
    ensureGames, ensureUsers,
    listToProcess, listToProcessByMethod,
    markUrlProcessed, updateGame, updateGamesForGeek,
    updateLastScheduledForUrls, updateUserValues
} from "./mysql-rds";
import {FileToProcess, ProcessCollectionResult, ProcessGameResult, ProcessUserResult} from "./interfaces";


export function processGameResult(event, context, callback: Callback) {
    console.log(event);
    const data = event as ProcessGameResult;
    const promise = updateGame(data)
        .then(() => markUrlProcessed("processGame", data.url));
    promiseToCallback(promise, callback);
}

export function processUserResult(event, context, callback: Callback) {
    console.log(event);
    const data = event as ProcessUserResult;
    const promise = updateUserValues(data.geek, data.bggid, data.country)
        .then(() => markUrlProcessed("processUser", data.url));
    promiseToCallback(promise, callback);
}

// Lambda to receive the list of users from processUserList and make sure they are all in the database
export function updateUserList(event, context, callback: Callback) {
    const body = event;
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

export function processCollectionRestrictToIDs(event, context, callback: Callback) {
    const params = event as { geek: string, items: [number] };
    const geek = params.geek;
    const ids = params.items;
    console.log(ids);
    // TODO
}

export function processCollectionUpdateGames(event, context, callback: Callback) {
   const params = event as ProcessCollectionResult;
   console.log(params);
   const promise = ensureGames(params.items)
       .then(() => updateGamesForGeek(params.geek, params.items));
   promiseToCallback(promise, callback);
}

export function updateUrlAsProcessed(event, context, callback: Callback) {
    const params = event as FileToProcess;
    promiseToCallback(markUrlProcessed(params.processMethod, params.url), callback);
}

function promiseToCallback<T>(promise: Promise<T>, callback: Callback) {
    promise
        .then(v => callback(undefined, v))
        .catch(err => callback(err));
}

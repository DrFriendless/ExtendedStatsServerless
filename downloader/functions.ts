import {Callback} from "aws-lambda";
import {ProcessCollectionResult, CollectionGame, FileToProcess, ToProcessElement} from "./interfaces"
import {invokelambdaAsync, invokelambdaSync, promiseToCallback} from "./library";
import {extractGameDataFromPage, extractUserCollectionFromPage, extractUserDataFromPage} from "./extraction";

const request = require('request-promise-native');
// the max files to start processing for at once
const PROCESS_COUNT = 1;
const INSIDE_PREFIX = "inside-dev-";
const OUTSIDE_PREFIX = "downloader-dev-";

// method names from the database - this is the type of thing we have to do.
const METHOD_PROCESS_USER = "processUser";
const METHOD_PROCESS_COLLECTION = "processCollection";
const METHOD_PROCESS_PLAYED = "processPlayed";
const METHOD_PROCESS_GAME = "processGame";

// lambda names we expect to see
const FUNCTION_RETRIEVE_FILES = "getToProcessList";
const FUNCTION_UPDATE_USER_LIST = "updateUserList";
const FUNCTION_PROCESS_USER = "processUser";
const FUNCTION_PROCESS_USER_RESULT = "processUserResult";
const FUNCTION_PROCESS_COLLECTION = "processCollection";
const FUNCTION_PROCESS_GAME = "processGame";
const FUNCTION_PROCESS_GAME_RESULT = "processGameResult";
const FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES = "processCollectionUpdateGames";
const FUNCTION_PROCESS_COLLECTION_RESTRICT_IDS = "processCollectionRestrictToIDs";
const FUNCTION_PROCESS_PLAYED = "processPlayed";
const FUNCTION_MARK_PROCESSED = "updateUrlAsProcessed";

const MAX_GAMES_PER_CALL = 500;

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export function processUserList(event, context, callback: Callback) {
    const usersFile = process.env["USERS_FILE"];
    promiseToCallback(request(usersFile)
            .then(data => invokelambdaAsync("processUserList", INSIDE_PREFIX + FUNCTION_UPDATE_USER_LIST, data))
            .then(data => console.log('Sent ' + data.split(/\r?\n/).length + ' users to ' + FUNCTION_UPDATE_USER_LIST)),
        callback);
}

// Lambda to get files to be processed and invoke the lambdas to do that
export function fireFileProcessing(event, context, callback: Callback) {
    console.log("fireFileProcessing");
    console.log(event);
    let count = PROCESS_COUNT;
    if (event.hasOwnProperty("count")) count = event.count;
    const payload = { count: count, updateLastScheduled: true };
    if (event.hasOwnProperty("processMethod")) {
        Object.assign(payload, {processMethod: event.processMethod});
    }
    const promise = invokelambdaSync("{}", INSIDE_PREFIX + FUNCTION_RETRIEVE_FILES, payload)
        .then(data => {
            const files = data as [ToProcessElement];
            files.forEach(element => {
                if (element.processMethod == METHOD_PROCESS_USER) {
                    return invokelambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_USER, element);
                } else if (element.processMethod == METHOD_PROCESS_COLLECTION) {
                    return invokelambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION, element);
                } else if (element.processMethod == METHOD_PROCESS_PLAYED) {
                    return invokelambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_PLAYED, element);
                } else if (element.processMethod == METHOD_PROCESS_GAME) {
                    return invokelambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_GAME, element);
                }
            });
            return files.length;
        });
    promiseToCallback(promise, callback);
}

// Lambda to harvest data about a user
export function processGame(event, context, callback: Callback) {
    console.log("processGame");
    console.log(event);
    const invocation = event as FileToProcess;

    promiseToCallback(
        request(invocation.url)
            .then(data => extractGameDataFromPage(invocation.bggid, invocation.url, data.toString()))
            .then(result => {
                console.log(result);
                return result;
            })
            .then(result => invokelambdaAsync("processGame", INSIDE_PREFIX + FUNCTION_PROCESS_GAME_RESULT, result)),
        callback);
}

// Lambda to harvest data about a user
export function processUser(event, context, callback: Callback) {
    console.log("processUser");
    console.log(event);
    const invocation = event as FileToProcess;

    promiseToCallback(
        request(invocation.url)
            .then(data => extractUserDataFromPage(invocation.geek, invocation.url, data.toString()))
            .then(result => {
                console.log(result);
                return result;
            })
            .then(result => invokelambdaAsync("processUser", INSIDE_PREFIX + FUNCTION_PROCESS_USER_RESULT, result)),
        callback);
}

// Lambda to harvest a user's collection
export function processCollection(event, context, callback: Callback) {
    console.log("processCollection");
    console.log(event);
    const invocation = event as FileToProcess;

    promiseToCallback(
        request(invocation.url)
            .then(data => extractUserCollectionFromPage(invocation.geek, invocation.url, data.toString()))
            .then(result => {
                console.log(result);
                return result;
            })
            .then(result => deleteGamesFromCollection(result))
            .then(result => addGamesToCollection(result))
            .then(v => markAsProcessed("processCollection", invocation)),
        callback);
}

function deleteGamesFromCollection(collection: ProcessCollectionResult): Promise<ProcessCollectionResult> {
    return invokelambdaAsync("processCollection",
        INSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION_RESTRICT_IDS,
        { geek: collection.geek, items: collection.items.map(item => item.gameId) })
        .then(() => collection);
}

function markAsProcessed(context: string, fileDetails: FileToProcess): Promise<void> {
    return invokelambdaAsync(context, INSIDE_PREFIX + FUNCTION_MARK_PROCESSED, fileDetails);
}

function addGamesToCollection(collection: ProcessCollectionResult): Promise<any> {
    return Promise.all(
        splitCollection(collection)
            .map(games => invokelambdaAsync("processCollection", INSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES, games))
    );
}

function splitCollection(original: ProcessCollectionResult): [ProcessCollectionResult] {
    const geek = original.geek;
    const split = splitItems(original.items);
    return split.map(items => { return { geek: geek, items: items } as ProcessCollectionResult});
}

function splitItems(items: [CollectionGame]): [[CollectionGame]] {
    if (items.length < MAX_GAMES_PER_CALL) {
        return [items];
    } else {
        const result = [];
        for (let i=0, j=items.length; i<j; i+=MAX_GAMES_PER_CALL) {
            result.push(items.slice(i,i+MAX_GAMES_PER_CALL));
        }
        return result;
    }
}









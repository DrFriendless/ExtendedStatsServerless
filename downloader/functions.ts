import {Callback} from "aws-lambda";
import {
    ProcessUserInvocation,
    ProcessCollectionResult,
    CollectionGame
} from "./interfaces"
import {invokelambdaAsync, invokelambdaSync} from "./library";
import {extractUserCollectionFromPage, extractUserDataFromPage} from "./extraction";

const request = require('request-promise-native');
// the max files to start processing for at once
const PROCESS_COUNT = 1;
const INSIDE_PREFIX = "inside-dev-";
const OUTSIDE_PREFIX = "downloader-dev-";

// method names from the database - this is the type of thing we have to do.
const METHOD_PROCESS_USER = "processUser";
const METHOD_PROCESS_COLLECTION = "processCollection";
const METHOD_PROCESS_PLAYED = "processPlayed";

// lambda names we expect to see
const FUNCTION_RETRIEVE_FILES = "getToProcessList";
const FUNCTION_UPDATE_USER_LIST = "updateUserList";
const FUNCTION_PROCESS_USER = "processUser";
const FUNCTION_PROCESS_USER_RESULT = "processUserResult";
const FUNCTION_PROCESS_COLLECTION = "processCollection";
const FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES = "processCollectionUpdateGames";
const FUNCTION_PROCESS_COLLECTION_RESTRICT_IDS = "processCollectionRestrictToIDs";
const FUNCTION_PROCESS_PLAYED = "processPlayed";
const FUNCTION_MARK_PROCESSED = "updateUrlAsProcessed";

const MAX_GAMES_PER_CALL = 500;

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export function processUserList(event, context, callback: Callback) {
    const usersFile = process.env["USERS_FILE"];
    request(usersFile)
        .then(data => invokelambdaAsync("processUserList", INSIDE_PREFIX + FUNCTION_UPDATE_USER_LIST, data))
        .then(data => console.log('Sent ' + data.split(/\r?\n/).length + ' users to ' + FUNCTION_UPDATE_USER_LIST))
        .then(v => callback(undefined, v))
        .catch(err => {
            console.log(err);
            callback(err);
        });
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
    return invokelambdaSync("{}", INSIDE_PREFIX + FUNCTION_RETRIEVE_FILES, payload)
        .then(data => {
            console.log(data);
            data.forEach(element => {
                if (element.processMethod == METHOD_PROCESS_USER) {
                    return invokelambdaAsync("invokeProcessUser", OUTSIDE_PREFIX + FUNCTION_PROCESS_USER, element);
                } else if (element.processMethod == METHOD_PROCESS_COLLECTION) {
                    return invokelambdaAsync("invokeProcessUser", OUTSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION, element);
                } else if (element.processMethod == METHOD_PROCESS_PLAYED) {
                    return invokelambdaAsync("invokeProcessUser", OUTSIDE_PREFIX + FUNCTION_PROCESS_PLAYED, element);
                }
            });
            return data.length;
        })
        .then(n => callback(undefined, n))
        .catch(err => {
            console.log(err);
            callback(err);
        });
}

// Lambda to harvest data about a user
export function processUser(event, context, callback: Callback) {
    console.log("processUser");
    console.log(event);
    const invocation = event as ProcessUserInvocation;

    request(invocation.url)
        .then(data => extractUserDataFromPage(invocation.geek, invocation.url, data.toString()))
        .then(result => {
            console.log(result);
            return result;
        })
        .then(result => invokelambdaAsync("processUser", INSIDE_PREFIX + FUNCTION_PROCESS_USER_RESULT, result))
        .then(v => callback(undefined, v))
        .catch(err => {
            console.log(err);
            callback(err);
        });
}

// Lambda to harvest a user's collection
export function processCollection(event, context, callback: Callback) {
    console.log("processCollection");
    console.log(event);
    const invocation = event as ProcessUserInvocation;

    request(invocation.url)
        .then(data => extractUserCollectionFromPage(invocation.geek, invocation.url, data.toString()))
        .then(result => {
            console.log(result);
            return result;
        })
        .then(result => deleteGamesFromCollection(result))
        .then(result => addGamesToCollection(result))
        .then(v => markAsProcessed("processCollection", invocation))
        .then(v => callback(undefined, v))
        .catch(err => {
            console.log(err);
            callback(err);
        });
}

function deleteGamesFromCollection(collection: ProcessCollectionResult): Promise<ProcessCollectionResult> {
    return invokelambdaAsync("processCollection",
        INSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION_RESTRICT_IDS,
        { geek: collection.geek, items: collection.items.map(item => item.gameId) })
        .then(() => collection);
}

function markAsProcessed(context: string, fileDetails: ProcessUserInvocation): Promise<void> {
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
    return split.map(items => { return {geek: geek, items: items } });
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








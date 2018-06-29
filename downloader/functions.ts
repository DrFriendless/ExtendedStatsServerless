import {Callback} from "aws-lambda";
import {ProcessCollectionResult, FileToProcess, ToProcessElement} from "./interfaces"
import {invokeLambdaAsync, invokeLambdaSync, promiseToCallback} from "./library";
import {extractGameDataFromPage, extractUserCollectionFromPage, extractUserDataFromPage} from "./extraction";
import * as _ from "lodash";

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
const FUNCTION_MARK_UNPROCESSED = "updateUrlAsUnprocessed";

const MAX_GAMES_PER_CALL = 500;

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export function processUserList(event, context, callback: Callback) {
    const usersFile = process.env["USERS_FILE"];
    let count;
    promiseToCallback(request(encodeURI(usersFile))
            .then(data => {
                count = data.split(/\r?\n/).length;
                return data;
            })
            .then(data => invokeLambdaAsync("processUserList", INSIDE_PREFIX + FUNCTION_UPDATE_USER_LIST, data))
            .then(() => console.log('Sent ' + count + ' users to ' + FUNCTION_UPDATE_USER_LIST)),
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
    const promise = invokeLambdaSync("{}", INSIDE_PREFIX + FUNCTION_RETRIEVE_FILES, payload)
        .then(data => {
            console.log(data);
            const files = data as [ToProcessElement];
            files.forEach(element => {
                if (element.processMethod == METHOD_PROCESS_USER) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_USER, element);
                } else if (element.processMethod == METHOD_PROCESS_COLLECTION) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION, element);
                } else if (element.processMethod == METHOD_PROCESS_PLAYED) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_PLAYED, element);
                } else if (element.processMethod == METHOD_PROCESS_GAME) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_GAME, element);
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
        request(encodeURI(invocation.url))
            .then(data => extractGameDataFromPage(invocation.bggid, invocation.url, data.toString()))
            .then(result => {
                console.log(result);
                return result;
            })
            .then(result => invokeLambdaAsync("processGame", INSIDE_PREFIX + FUNCTION_PROCESS_GAME_RESULT, result)),
        callback);
}

// Lambda to harvest data about a user
export function processUser(event, context, callback: Callback) {
    console.log("processUser");
    console.log(event);
    const invocation = event as FileToProcess;

    promiseToCallback(
        request(encodeURI(invocation.url))
            .then(data => extractUserDataFromPage(invocation.geek, invocation.url, data.toString()))
            .then(result => {
                console.log(result);
                return result;
            })
            .then(result => invokeLambdaAsync("processUser", INSIDE_PREFIX + FUNCTION_PROCESS_USER_RESULT, result)),
        callback);
}

// Lambda to harvest a user's collection
export function processCollection(event, context, callback: Callback) {
    console.log(event);
    const invocation = event as FileToProcess;
    return tryToProcessCollection(invocation)
        .then(() => callback(null, null))
        .catch(err => {
            console.log(err);
            promiseToCallback(markAsUnprocessed("processCollection", invocation), callback);
        });
}

// return success
function tryToProcessCollection(invocation: FileToProcess): Promise<void> {
    let retry = false;
    const options = { uri: encodeURI(invocation.url), resolveWithFullResponse: true };
    let collection;
    return request.get(options)
        .then(response => {
            console.log(response.statusCode);
            if (response.statusCode == 202) {
                // TODO - record this in the DB
                retry = true;
                throw new Error("BGG says to wait a bit.");
            }
            return response.body;
        })
        .then(data => extractUserCollectionFromPage(invocation.geek, invocation.url, data.toString()))
        .then(result => { collection = result; console.log(collection); })
        .then(() => deleteGamesFromCollection(collection))
        .then(() => addGamesToCollection(collection))
        .then(() => markAsProcessed("processCollection", invocation))
        .then(() => true)
        .catch(err => {
            if (retry) return Promise.resolve(false);
            throw err;
        });
}

function deleteGamesFromCollection(collection: ProcessCollectionResult): Promise<ProcessCollectionResult> {
    return invokeLambdaAsync("processCollection",
        INSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION_RESTRICT_IDS,
        { geek: collection.geek, items: collection.items.map(item => item.gameId) })
        .then(() => collection);
}

function markAsProcessed(context: string, fileDetails: FileToProcess): Promise<void> {
    return invokeLambdaAsync(context, INSIDE_PREFIX + FUNCTION_MARK_PROCESSED, fileDetails);
}

function markAsUnprocessed(context: string, fileDetails: FileToProcess): Promise<void> {
    return invokeLambdaAsync(context, INSIDE_PREFIX + FUNCTION_MARK_UNPROCESSED, fileDetails);
}

function addGamesToCollection(collection: ProcessCollectionResult): Promise<any> {
    return Promise.all(
        splitCollection(collection)
            .map(games => invokeLambdaAsync("processCollection", INSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES, games))
    );
}

function splitCollection(original: ProcessCollectionResult): ProcessCollectionResult[] {
    return _.chunk(original.items, MAX_GAMES_PER_CALL)
        .map(items => { return { geek: original.geek, items: items } as ProcessCollectionResult});
}









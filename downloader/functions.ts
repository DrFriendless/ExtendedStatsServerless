import {Callback} from "aws-lambda";
import {
    ProcessCollectionResult,
    FileToProcess,
    ToProcessElement,
    CleanUpCollectionResult,
    MonthPlayed, ProcessMonthsPlayedResult, ProcessPlaysResult
} from "./interfaces"
import {between, invokeLambdaAsync, invokeLambdaSync, promiseToCallback} from "./library";
import {
    extractGameDataFromPage,
    extractUserCollectionFromPage,
    extractUserDataFromPage,
    NoSuchGameError, processPlaysFile
} from "./extraction";
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
const METHOD_PROCESS_PLAYS = "processPlays";

// lambda names we expect to see
const FUNCTION_RETRIEVE_FILES = "getToProcessList";
const FUNCTION_UPDATE_USER_LIST = "updateUserList";
const FUNCTION_PROCESS_USER = "processUser";
const FUNCTION_PROCESS_USER_RESULT = "processUserResult";
const FUNCTION_PROCESS_COLLECTION = "processCollection";
const FUNCTION_PROCESS_PLAYED_RESULT = "processPlayedMonthsResult";
const FUNCTION_PROCESS_PLAYS_RESULT = "processPlaysResult";
const FUNCTION_PROCESS_GAME = "processGame";
const FUNCTION_PROCESS_PLAYS = "processPlays";
const FUNCTION_PROCESS_GAME_RESULT = "processGameResult";
const FUNCTION_NO_SUCH_GAME = "updateGameAsDoesNotExist";
const FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES = "processCollectionUpdateGames";
const FUNCTION_PROCESS_COLLECTION_CLEANUP = "processCollectionCleanup";
const FUNCTION_PROCESS_PLAYED = "processPlayed";
const FUNCTION_MARK_PROCESSED = "updateUrlAsProcessed";
const FUNCTION_MARK_UNPROCESSED = "updateUrlAsUnprocessed";
const FUNCTION_MARK_TOMORROW = "updateUrlAsTryTomorrow";

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
    console.log(event);
    let count = PROCESS_COUNT;
    if (event.hasOwnProperty("count")) count = event.count;
    const payload = { count: count, updateLastScheduled: true };
    if (event.hasOwnProperty("processMethod")) {
        Object.assign(payload, {processMethod: event.processMethod});
    }
    const promise = invokeLambdaSync("{}", INSIDE_PREFIX + FUNCTION_RETRIEVE_FILES, payload)
        .then(data => {
            const files = data as ToProcessElement[];
            files.forEach(element => {
                // if (event.hasOwnProperty("processMethod")) console.log(element);
                console.log(element);
                if (element.processMethod == METHOD_PROCESS_USER) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_USER, element);
                } else if (element.processMethod == METHOD_PROCESS_COLLECTION) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION, element);
                } else if (element.processMethod == METHOD_PROCESS_PLAYED) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_PLAYED, element);
                } else if (element.processMethod == METHOD_PROCESS_GAME) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_GAME, element);
                } else if (element.processMethod == METHOD_PROCESS_PLAYS) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_PLAYS, element);
                }
            });
            return files.length;
        });
    promiseToCallback(promise, callback);
}

// Lambda to harvest data about a game
export async function processGame(event, context, callback: Callback) {
    console.log(event);
    const invocation = event as FileToProcess;
    const data = await request(encodeURI(invocation.url));
    try {
        const result = await extractGameDataFromPage(invocation.bggid, invocation.url, data.toString());
        await invokeLambdaAsync("processGame", INSIDE_PREFIX + FUNCTION_PROCESS_GAME_RESULT, result);
        callback(null, null);
    } catch (err) {
        console.log(err);
        if (err instanceof NoSuchGameError) {
            await invokeLambdaAsync("processGame", INSIDE_PREFIX + FUNCTION_NO_SUCH_GAME, {bggid: err.getId()});
            callback(null, null);
        } else {
            console.log(err);
            callback(err);
        }
    }
}

// Lambda to harvest data about a user
export function processUser(event, context, callback: Callback) {
    console.log(event);
    const invocation = event as FileToProcess;

    promiseToCallback(
        request(encodeURI(invocation.url))
            .then(data => extractUserDataFromPage(invocation.geek, invocation.url, data.toString()))
            .then(result => invokeLambdaAsync("processUser", INSIDE_PREFIX + FUNCTION_PROCESS_USER_RESULT, result)),
        callback);
}

// Lambda to harvest a user's collection
export async function processCollection(event, context, callback: Callback) {
    console.log(event);
    const invocation = event as FileToProcess;
    try {
        await tryToProcessCollection(invocation);
        await markTryAgainTomorrow("processCollection", invocation);
        callback(null, null);
    } catch (e) {
        console.log(e);
        await markAsUnprocessed("processCollection", invocation);
        callback(null, e);
    }
}

// return success
async function tryToProcessCollection(invocation: FileToProcess): Promise<number> {
    const options = { uri: encodeURI(invocation.url), resolveWithFullResponse: true };
    let response;
    try {
        response = await request.get(options);
        console.log("got response");
        console.log(response);
        if (response.statusCode == 202) {
            throw new Error("BGG says to wait a bit.");
            // return 202;
        }
    } catch (e) {
        // 504 is a BGG timeout.
        if ((e as Error).message.lastIndexOf("504") >= 0) return 504;
        throw e;
    }
    const collection = await extractUserCollectionFromPage(invocation.geek, invocation.url, response.body.toString());
    console.log(collection);
    for (const games of splitCollection(collection)) {
        await invokeLambdaAsync("processCollection", INSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES, games);
        console.log("invoked " + FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES + " for " + games.items.length + " games.");
    }
    await cleanupCollection(collection, invocation.url);
    console.log("cleaned up collection");
    return 200;
}

async function cleanupCollection(collection: ProcessCollectionResult, url: string) {
    const params: CleanUpCollectionResult = {
        geek: collection.geek,
        items: collection.items.map(item => item.gameId),
        url: url
    };
    await invokeLambdaAsync("processCollection", INSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION_CLEANUP, params);
}

function markAsProcessed(context: string, fileDetails: FileToProcess): Promise<void> {
    return invokeLambdaAsync(context, INSIDE_PREFIX + FUNCTION_MARK_PROCESSED, fileDetails);
}

async function markAsUnprocessed(context: string, fileDetails: FileToProcess) {
    return invokeLambdaAsync(context, INSIDE_PREFIX + FUNCTION_MARK_UNPROCESSED, fileDetails);
}

async function markTryAgainTomorrow(context: string, fileDetails: FileToProcess) {
    return invokeLambdaAsync(context, INSIDE_PREFIX + FUNCTION_MARK_TOMORROW, fileDetails);
}

function splitCollection(original: ProcessCollectionResult): ProcessCollectionResult[] {
    return _.chunk(original.items, MAX_GAMES_PER_CALL)
        .map(items => { return { geek: original.geek, items: items } as ProcessCollectionResult});
}

export async function processPlayed(event, context, callback: Callback) {
    console.log(event);
    const invocation = event as FileToProcess;
    const data = await request(encodeURI(invocation.url)) as string;
    const toAdd = [] as MonthPlayed[];
    data.split("\n")
        .filter(line => line.indexOf(">By date<") >= 0)
        .forEach(line => {
            const s = between(line, '/end/', '"');
            const fields = s.split('-');
            const data = { month: parseInt(fields[1]), year: parseInt(fields[0]) } as MonthPlayed;
            toAdd.push(data);
        });
    const monthsData = { geek: invocation.geek, monthsPlayed: toAdd, url: invocation.url } as ProcessMonthsPlayedResult;
    await invokeLambdaAsync("processPlayed", INSIDE_PREFIX + FUNCTION_PROCESS_PLAYED_RESULT, monthsData);
}

export async function processPlays(event, context, callback: Callback) {
    console.log(event);
    const invocation = event as FileToProcess;
    const data = await request(invocation.url) as string;
    const playsData = await processPlaysFile(data, invocation);
    const playsResult = { geek: invocation.geek, month: invocation.month, year: invocation.year, plays: playsData, url: invocation.url } as ProcessPlaysResult;
    await invokeLambdaAsync("processPlayed", INSIDE_PREFIX + FUNCTION_PROCESS_PLAYS_RESULT, playsResult);
}


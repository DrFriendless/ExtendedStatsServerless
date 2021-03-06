import { Callback, Context } from "aws-lambda";
import {
    ProcessCollectionResult,
    FileToProcess,
    ToProcessElement,
    CleanUpCollectionResult,
    MonthPlayed,
    ProcessPlaysResult,
    SeriesMetadata,
    MetadataRule,
    METADATA_RULE_BASEGAME,
    Metadata, PlayData
} from "./interfaces";
import { between, invokeLambdaAsync, invokeLambdaSync, promiseToCallback } from "./library";
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
const METHOD_PROCESS_DESIGNER = "processDesigner";
const METHOD_PROCESS_PUBLISHER = "processPublisher";

// lambda names we expect to see
const FUNCTION_RETRIEVE_FILES = "getToProcessList";
const FUNCTION_UPDATE_USER_LIST = "updateUserList";
const FUNCTION_UPDATE_METADATA = "updateMetadata";
const FUNCTION_UPDATE_TOP50 = "updateBGGTop50";
const FUNCTION_PROCESS_USER = "processUser";
const FUNCTION_PROCESS_USER_RESULT = "processUserResult";
const FUNCTION_PROCESS_COLLECTION = "processCollection";
const FUNCTION_PROCESS_PLAYED_RESULT = "processPlayedMonthsResult";
const FUNCTION_PROCESS_PLAYS_RESULT = "processPlaysResult";
const FUNCTION_PROCESS_GAME = "processGame";
const FUNCTION_PROCESS_PLAYS = "processPlays";
const FUNCTION_PROCESS_DESIGNER = "processDesigner";
const FUNCTION_PROCESS_PUBLISHER = "processPublisher";
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
export function processUserList(event, context: Context, callback: Callback) {
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

// Lambda to get the metadata from pastebin and send it to the database.
export async function processMetadata(event, context: Context, callback: Callback) {
    const metadataFile = process.env["METADATA_FILE"];
    const series: SeriesMetadata[] = [];
    const rules: MetadataRule[] = [];
    try {
        const data = await request(encodeURI(metadataFile));
        const lines = data.split(/\r?\n/).map(s => s.trim());
        for (const line of lines) {
            if (line.length === 0) continue;
            if (line.startsWith('#')) continue;
            let handled = false;
            if (line.indexOf(':') > 0) {
                const fields = line.split(/:/).map(s => s.trim());
                const title = fields[0];
                const gameIds = fields[1].split(/\s+/).map(x => parseInt(x)).filter(Number.isInteger);
                if (title.length > 0 && gameIds.length > 0) {
                    handled = true;
                    series.push({ name: title, games: gameIds });
                }
            } else {
                const fields = line.split(/\s+/).map(s => s.trim());
                if (fields.length === 2) {
                    const gameId = parseInt(fields[1]);
                    if (fields[0] === "basegame" && Number.isInteger(gameId)) {
                        handled = true;
                        rules.push({ rule: METADATA_RULE_BASEGAME, game: gameId });
                    }
                }
            }
            if (!handled) console.log("Did not understand metadata: " + line);
        }
        const toUpdate: Metadata = { series, rules };
        await invokeLambdaAsync("processMetadata", INSIDE_PREFIX + FUNCTION_UPDATE_METADATA, toUpdate);
        callback();
    } catch (e) {
        callback(e);
    }
}

export async function processBGGTop50(event, context: Context, callback: Callback) {
    const TOP50_URL = "https://www.boardgamegeek.com/browse/boardgame";
    try {
        const data = await request(TOP50_URL);
        const lines: string[] = data
            .split(/\r?\n/)
            .map(s => s.trim());
        const top100 = _.dropWhile(lines, s => s.indexOf("<th class='collection_bggrating'>") < 0)
            .filter(s => s.indexOf('href="/boardgame/') >= 0)
            .filter(s => s.indexOf('<img') >= 0)
            .map(s => between(s, 'href="/boardgame/', '/'))
            .map(s => parseInt(s));
        const top50 = _.take(top100, 50);
        await invokeLambdaAsync("processBGGTop50", INSIDE_PREFIX + FUNCTION_UPDATE_TOP50, top50);
    } catch (e) {
        callback(e);
    }
}

// Lambda to get files to be processed and invoke the lambdas to do that
export function fireFileProcessing(event, context: Context, callback: Callback) {
    let count = PROCESS_COUNT;
    const envCount = process.env["COUNT"];
    if (parseInt(envCount)) count = parseInt(envCount);
    if (event.hasOwnProperty("count")) count = event.count;
    const payload = { count: count, updateLastScheduled: true };
    if (event.hasOwnProperty("processMethod")) {
        Object.assign(payload, {processMethod: event.processMethod});
    }
    const promise = invokeLambdaSync("{}", INSIDE_PREFIX + FUNCTION_RETRIEVE_FILES, payload)
        .then(data => {
            const files = data as ToProcessElement[];
            files.forEach(element => {
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
                } else if (element.processMethod == METHOD_PROCESS_DESIGNER) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_DESIGNER, element);
                } else if (element.processMethod == METHOD_PROCESS_PUBLISHER) {
                    return invokeLambdaAsync("fireFileProcessing", OUTSIDE_PREFIX + FUNCTION_PROCESS_PUBLISHER, element);
                }
            });
            return { count: files.length };
        });
    promiseToCallback(promise, callback);
}

// Lambda to harvest data about a game
export async function processGame(event, context: Context, callback: Callback) {
    const invocation = event as FileToProcess;
    console.log(invocation.url);
    const data = await request(encodeURI(invocation.url));
    try {
        const result = await extractGameDataFromPage(invocation.bggid, invocation.url, data.toString());
        await invokeLambdaAsync("processGame", INSIDE_PREFIX + FUNCTION_PROCESS_GAME_RESULT, result);
        callback();
    } catch (err) {
        console.log(err);
        if (err instanceof NoSuchGameError) {
            await invokeLambdaAsync("processGame", INSIDE_PREFIX + FUNCTION_NO_SUCH_GAME, {bggid: err.getId()});
            callback();
        } else {
            console.log(err);
            callback(err);
        }
    }
}

// Lambda to harvest data about a user
export function processUser(event, context: Context, callback: Callback) {
    console.log(event);
    const invocation = event as FileToProcess;

    promiseToCallback(
        request(encodeURI(invocation.url))
            .then(data => extractUserDataFromPage(invocation.geek, invocation.url, data.toString()))
            .then(result => invokeLambdaAsync("processUser", INSIDE_PREFIX + FUNCTION_PROCESS_USER_RESULT, result)),
        callback);
}

// Lambda to harvest a user's collection
export async function processCollection(invocation: FileToProcess, context: Context, callback: Callback) {
    try {
        const code = await tryToProcessCollection(invocation);
        if (code === 202) {
            await markAsUnprocessed("processCollection", invocation);
        } else if (code > 500) {
            await markTryAgainTomorrow("processCollection", invocation);
        }
        callback();
    } catch (e) {
        console.log(invocation);
        if (e.toString().includes("Collection exceeds maximum export size")) {
            console.log("try again tomorrow");
            await markTryAgainTomorrow("processCollection", invocation);
        } else {
            await markAsUnprocessed("processCollection", invocation);
        }
        callback(e);
    }
}

// return success
async function tryToProcessCollection(invocation: FileToProcess): Promise<number> {
    const options = { uri: encodeURI(invocation.url), resolveWithFullResponse: true };
    let response;
    try {
        response = await request.get(options);
        if (response.statusCode == 202) return 202;
    } catch (e) {
        // 504 is a BGG timeout.
        if ((e as Error).message.lastIndexOf("504") >= 0) return 504;
        throw e;
    }
    const collection = await extractUserCollectionFromPage(invocation.geek, invocation.url, response.body.toString());
    const ids = collection.items.map(item => item.gameId);
    // make sure that all of these games are in the database
    // if there are a lot, this lambda might timeout, but next time more of them will be there.
    const added = await ensureGames(ids);
    if (added.length > 0) console.log("Added " + added + " to the database for " + invocation.geek);
    for (const games of splitCollection(collection)) {
        await invokeLambdaAsync("processCollection", INSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES, games);
        console.log("invoked " + FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES + " for " + games.items.length + " games.");
    }
    await cleanupCollection(collection, invocation.url);
    return 200;
}

async function ensureGames(ids: number[]): Promise<number[]> {
    const options = {
        uri: "http://eb.drfriendless.com/downloader/ensuregames",
        json: ids
    };
    return request.post(options).auth("downloader", process.env["downloaderPassword"]);
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
        .map(items => { return { geek: original.geek, items: items }; });
}

export async function processPlayed(invocation: FileToProcess, context: Context, callback: Callback) {
    const data: string = await request(encodeURI(invocation.url));
    const toAdd: MonthPlayed[] = [];
    data.split("\n")
        .filter(line => line.indexOf(">By date<") >= 0)
        .forEach(line => {
            const s = between(line, '/end/', '"');
            const fields = s.split('-');
            const data = { month: parseInt(fields[1]), year: parseInt(fields[0]) };
            toAdd.push(data);
        });
    const monthsData = { geek: invocation.geek, monthsPlayed: toAdd, url: invocation.url };
    await invokeLambdaAsync("processPlayed", INSIDE_PREFIX + FUNCTION_PROCESS_PLAYED_RESULT, monthsData);
}

export async function processPlays(invocation: FileToProcess, context: Context, callback: Callback) {
    let playsData: PlayData[] = [];
    let pagesSoFar = 0;
    let pagesNeeded = -1;
    while (pagesSoFar === 0 || pagesSoFar < pagesNeeded) {
        pagesSoFar++;
        const data: string = await request(invocation.url + "&page=" + pagesSoFar);
        const processResult: { count: number, plays: PlayData[] } = await processPlaysFile(data, invocation);
        playsData = playsData.concat(processResult.plays);
        pagesNeeded = Math.ceil(processResult.count / 100);
    }
    const playsResult: ProcessPlaysResult = {
        geek: invocation.geek, month: invocation.month, year: invocation.year, plays: playsData, url: invocation.url
    };
    if (playsData.length > 2000) {
        // synchronous invocations can take a much larger payload than async ones, and around 2000 plays we hit the limit.
        // https://www.stackery.io/blog/RequestEntityTooLargeException-aws-lambda-message-invocation-limits/
        await invokeLambdaSync("processPlayed", INSIDE_PREFIX + FUNCTION_PROCESS_PLAYS_RESULT, playsResult);
    } else {
        await invokeLambdaAsync("processPlayed", INSIDE_PREFIX + FUNCTION_PROCESS_PLAYS_RESULT, playsResult);
    }
}

export async function processDesigner(event) {
    const invocation = event as FileToProcess;
    const data: string = await request(invocation.url);
    console.log(data);
}

export async function processPublisher(event) {
    const invocation = event as FileToProcess;
    const data: string = await request(invocation.url);
    console.log(data);
}

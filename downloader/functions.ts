import {Callback} from "aws-lambda";
import {
    ProcessCollectionResult,
    FileToProcess,
    ToProcessElement,
    CleanUpCollectionResult,
    MonthPlayed, ProcessMonthsPlayedResult
} from "./interfaces"
import {between, invokeLambdaAsync, invokeLambdaSync, promiseToCallback} from "./library";
import {
    extractGameDataFromPage,
    extractUserCollectionFromPage,
    extractUserDataFromPage,
    NoSuchGameError
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

// lambda names we expect to see
const FUNCTION_RETRIEVE_FILES = "getToProcessList";
const FUNCTION_UPDATE_USER_LIST = "updateUserList";
const FUNCTION_PROCESS_USER = "processUser";
const FUNCTION_PROCESS_USER_RESULT = "processUserResult";
const FUNCTION_PROCESS_COLLECTION = "processCollection";
const FUNCTION_PROCESS_GAME = "processGame";
const FUNCTION_PROCESS_GAME_RESULT = "processGameResult";
const FUNCTION_NO_SUCH_GAME = "updateGameAsDoesNotExist";
const FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES = "processCollectionUpdateGames";
const FUNCTION_PROCESS_COLLECTION_CLEANUP = "processCollectionCleanup";
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

// Lambda to harvest data about a game
export async function processGame(event, context, callback: Callback) {
    console.log("processGame");
    console.log(event);
    const invocation = event as FileToProcess;
    const data = await request(encodeURI(invocation.url));
    try {
        const result = await extractGameDataFromPage(invocation.bggid, invocation.url, data.toString());
        console.log(result);
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
export async function processCollection(event, context, callback: Callback) {
    console.log(event);
    const invocation = event as FileToProcess;
    try {
        await tryToProcessCollection(invocation);
        callback(null, null);
    } catch (e) {
        console.log(e);
        await markAsUnprocessed("processCollection", invocation);
        callback(null, e);
    }
}

// return success
async function tryToProcessCollection(invocation: FileToProcess) {
    const options = { uri: encodeURI(invocation.url), resolveWithFullResponse: true };
    let response = await request.get(options);
    if (response.statusCode == 202) {
        throw new Error("BGG says to wait a bit.");
    }
    const collection = await extractUserCollectionFromPage(invocation.geek, invocation.url, response.body.toString());
    console.log(collection);
    for (const games of splitCollection(collection)) {
        await invokeLambdaAsync("processCollection", INSIDE_PREFIX + FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES, games);
        console.log("invoked " + FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES + " for " + games.items.length + " games.");
    }
    await cleanupCollection(collection, invocation.url);
    console.log("cleaned up collection");
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

function splitCollection(original: ProcessCollectionResult): ProcessCollectionResult[] {
    return _.chunk(original.items, MAX_GAMES_PER_CALL)
        .map(items => { return { geek: original.geek, items: items } as ProcessCollectionResult});
}

export async function processPlayed(event, context, callback: Callback) {
    console.log(event);
    const invocation = event as FileToProcess;
    const data = await request(encodeURI(invocation.url)) as string;
    console.log(data);
    const toAdd = [] as MonthPlayed[];
    data.split("\n")
        .filter(line => line.indexOf(">By date<") >= 0)
        .forEach(line => {
            const s = between(line, '/end/', '"');
            const fields = s.split('-');
            const data = { month: parseInt(fields[1]), year: parseInt(fields[0]) } as MonthPlayed;
            console.log(data);
            toAdd.push(data);
        });
    const monthsData = { geek: invocation.geek, monthsPlayed: toAdd } as ProcessMonthsPlayedResult;
    console.log(monthsData);
}





// def processPlayed(db, filename, geek, url):
// import calendar, plays, datetime, library, logging
// existing = db.execute("select count(*) from monthsplayed where geek = '%s'" % geek)
// noneBefore = existing[0][0] == 0l
// toAdd = []
// for line in file(filename).readlines():
// if line.find(">By date<") >= 0:
// s = library.between(line, '/end/', '"')
// fields = s.split("-")
// data = [geek, fields[1], fields[0]]
// toAdd.append(data)
// if len(toAdd) > 0:
// ensureGeek(db, geek)
// db.execute("delete from monthsplayed where geek = '%s'" % geek)
// luData = {}
// lastUpdateTimes = db.execute("select url, lastupdate from files where geek = '%s' and processMethod = 'processPlays'" % geek)
// for (url, lu) in lastUpdateTimes:
//     luData[url] = lu
// db.execute("delete from files where geek = '%s' and processMethod = 'processPlays'" % geek)
// for data in toAdd:
// m = int(data[1])
// y = int(data[2])
// db.execute("insert into monthsplayed (geek, month, year) values ('%s', %s, %s)" % tuple(data))
// playsFile = "played_%s_%02d_%d.xml" % (geek, m, y)
// url = plays.NEW_PLAYED_URL % (urllib.quote(geek), y, m, y, m)
// if m == 0 and y == 0:
// daysSince = 10000
// url = "https://boardgamegeek.com/xmlapi2/plays?username=%s&mindate=0000-00-00&maxdate=0000-00-00&subtype=boardgame" % urllib.quote(geek)
// else:
// try:
// pd = datetime.date(y, m, calendar.monthrange(y,m)[1])
// except calendar.IllegalMonthError:
// logging.error("IllegalMonthError %d %d %s" % (y, m, `data`))
// daysSince = (datetime.date.today() - pd).days
// if daysSince <= 3:
// tillNext = '24:00:00'
// elif daysSince <= 30:
// tillNext = '72:00:00'
// elif daysSince <= 60:
// tillNext = '168:00:00'
// else:
// tillNext = None
// description = "Plays for %d/%s" % (y,m)
// lu = luData.get(url)
// if tillNext is not None:
//     if lu is not None:
//     mtime = lu.strftime('%Y-%m-%d %H:%M:%S')
// sql2 = "insert into files (filename, url, processMethod, geek, lastupdate, tillNextUpdate, description) values ('%s', '%s', 'processPlays', '%s', '%s', '%s', '%s')" % (playsFile, url, geek, mtime, tillNext, description)
// else:
// sql2 = "insert into files (filename, url, processMethod, geek, tillNextUpdate, description) values ('%s', '%s', 'processPlays', '%s', '%s', '%s')" % (playsFile, url, geek, tillNext, description)
// else:
// # no automatic next update - manual only
// if lu is not None:
//     mtime = lu.strftime('%Y-%m-%d %H:%M:%S')
// sql2 = "insert into files (filename, url, processMethod, geek, lastupdate, description) values ('% s', '%s', 'processPlays', '%s', '%s', '%s')" % (playsFile, url, geek, mtime, description)
// else:
// sql2 = "insert into files (filename, url, processMethod, geek, description) values ('%s', '%s', 'processPlays', '%s', '%s')" % (playsFile, url, geek, description)
// db.execute(sql2)
// sql3 = "update files set nextUpdate = addtime(lastUpdate, tillNextUpdate) where processMethod = 'processPlays' and geek = '%s'" % geek
// db.execute(sql3)
// sql4 = "delete from plays where geek = '%s' and date_format(playDate, '%%Y-%%m') not in (select distinct concat(right(concat('000',year), 4), '-', right(concat('0',month), 2)) from monthsplayed where geek = '%s')" % (geek, geek)
// db.execute(sql4)
// return 1
// elif noneBefore:
//     return 1
// else:
// print "nothing to add, check %s" % filename
// return 1

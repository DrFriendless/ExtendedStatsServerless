import {between, sleep} from "./library.mjs";
import {
    extractGameDataFromPage,
    extractUserCollectionFromPage,
    extractUserDataFromPage,
    NoSuchGameError
} from "./extraction.mjs";
import {
    dispatchEnsureGames,
    dispatchMarkAsProcessed,
    dispatchMarkAsTryAgainTomorrow,
    dispatchMarkAsUnprocessed,
    dispatchNoSuchGame,
    dispatchNoSuchUser,
    dispatchPlaysForPeriodResult,
    dispatchProcessCleanUpCollection,
    dispatchProcessCollectionUpdateGames,
    dispatchProcessGameResult,
    dispatchProcessUserResult, dispatchSlowDown,
    dispatchUpdateMetadata,
    dispatchUpdateTop50,
    dispatchUpdateUserList
} from "./dispatch.mjs";
import {
    CleanUpCollectionResult,
    FileToProcess,
    METADATA_RULE_BASEGAME,
    MetadataRule, PlayData, PlaysToProcess,
    ProcessCollectionResult, ProcessPlaysForPeriodResult,
    SeriesMetadata, UpdateMetadataMessage, UpdateTop50Message, UpdateUserListMessage
} from "extstats-core";
import {isHttpResponse, loadSystem, System} from "./system.mjs";
import {flushLogging, initLogging, log} from "./logging.mjs";
import {XMLParser} from "fast-xml-parser";
import * as _ from 'lodash-es';

const MAX_GAMES_PER_CALL = 1000;

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export async function processUserList(_: UpdateUserListMessage) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;
    await initLogging(system, "processUserList");

    console.log(system.usersFile);
    const resp = await fetch(system.usersFile);
    console.log(resp);
    if (resp.ok) {
        const data = await resp.text();
        console.log(data);
        const lines = data.split(/\r?\n/).map(s => s.trim()).filter(s => !!s);
        console.log(lines);
        await dispatchUpdateUserList(system, lines);
    } else {
        console.log("Unable to read users file");
        console.log(await resp.text());
    }
}

// Lambda to get the metadata from pastebin and send it to the database.
export async function processMetadata(_: UpdateMetadataMessage) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;
    await initLogging(system, "processMetadata");

    const resp = await fetch(system.metadataFile);
    const data = await resp.text();
    const lines: string[] = data.split(/\r?\n/).map(s => s.trim()).filter(s => !!s);

    const series: SeriesMetadata[] = [];
    const rules: MetadataRule[] = [];
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
        if (!handled) log(`Did not understand metadata: ${line}`);
    }
    await dispatchUpdateMetadata({ series, rules });
    await flushLogging();
}

export async function processBGGTop50(ignored: UpdateTop50Message) {
    const TOP50_URL = "https://www.boardgamegeek.com/browse/boardgame";
    const resp = await fetch(TOP50_URL);
    const data = await resp.text();
    const lines: string[] = data.split(/\r?\n/).map(s => s.trim()).filter(s => !!s);
    const top100 = _.dropWhile(lines, s => s.indexOf("<th class='collection_bggrating'>") < 0)
        .filter(s => s.indexOf('href="/boardgame/') >= 0)
        .filter(s => s.indexOf('<img') >= 0)
        .map(s => between(s, 'href="/boardgame/', '/'))
        .map(s => parseInt(s));
    const top50 = _.take(top100, 50);
    await dispatchUpdateTop50(top50);
}

// Lambda to harvest data about a game
export async function processGame(event: FileToProcess) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;
    await initLogging(system, "processGame");

    const invocation = event as FileToProcess;
    const data = await fetchXMLFromBGG(system.gamesToken, invocation.url, event);
    if (data) {
        try {
            const result = await extractGameDataFromPage(invocation.bggid, invocation.url, data);
            await dispatchProcessGameResult(system, result);
        } catch (err) {
            if (err instanceof NoSuchGameError) {
                await dispatchNoSuchGame(system, err.getId());
            } else {
                console.log(err);
            }
        }
    }
    await flushLogging();
}

async function fetchXMLFromBGG(token: string, url: string, task: object): Promise<string | undefined> {
    const resp = await fetchFromBGG(token, url);
    console.log(resp.url, resp.status);
    const xml = await resp.text();
    if (xml.indexOf("Rate limit exceeded") >= 0) {
        log(`Rate limit exceeded downloading ${url}, task was ${JSON.stringify(task)}`);
        return undefined;
    }
    return xml;
}

async function fetchFromBGG(token: string, url: string): Promise<Response> {
    return fetch(url, {
        headers: {
            "Accept": "application/xml",
            "Authorization": `Bearer ${token}`,
        }
    });
}

// Lambda to harvest data about a user
export async function processUser(event: FileToProcess) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;
    await initLogging(system, "processUser");

    const invocation = event as FileToProcess;

    const url = `https://api.geekdo.com/api/users?username=${encodeURIComponent(invocation.geek)}`;
    console.log(url);
    const resp = await fetchFromBGG(system.usersToken, url);
    console.log(resp);
    const data = await resp.json();
    console.log(data);
    // we send the invocation URL here as it is identification for the task, not actually the URL.
    const puResult = extractUserDataFromPage(invocation.geek, invocation.url, data);
    await dispatchProcessUserResult(system, puResult);

    await flushLogging();
}

// Lambda to harvest a user's collection
export async function processCollection(invocation: FileToProcess) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;
    await initLogging(system, "processCollection");

    try {
        const code = await tryToProcessCollection(system, invocation);
        if (code === 202) {
            await markAsUnprocessed(system, invocation);
        } else if (code > 500) {
            await markTryAgainTomorrow(system, invocation);
        } else if (code === 400) {
            log(`No such geek: ${invocation.geek}`)
        }
    } catch (e) {
        console.log(invocation);
        if (e.toString().includes("Collection exceeds maximum export size")) {
            console.log("try again tomorrow");
            await markTryAgainTomorrow(system, invocation);
        } else {
            await markAsUnprocessed(system, invocation);
        }
    }

    console.log(`processCollection ${invocation.geek} done`);
    await flushLogging();
}

// return success
async function tryToProcessCollection(system: System, invocation: FileToProcess): Promise<number> {
    const data = await fetchXMLFromBGG(system.collectionToken, invocation.url, invocation);
    if (!data) {
        log(`Rate limit exceeded processing collection for ${invocation.geek}`);
        await dispatchSlowDown(system);
        return 429;
    }
    const collection = await extractUserCollectionFromPage(invocation.geek, data, invocation.url);
    if (collection === "InvalidUsername") {
        log(`It looks like ${invocation.geek} no longer exists.`);
        await dispatchNoSuchUser(system, invocation.geek);
    } else if (collection === "RateLimitExceeded") {
        log(`Rate limit exceeded processing collection for ${invocation.geek}`);
        await dispatchSlowDown(system);
        return 429;
    } else if (collection === "IncorrectDOM") {
        log(`Incorrect DOM for URL ${invocation.url}`);
    } else if (collection === "ComeBackLater") {
        // TODO
    } else if (collection === "TooBig") {
        log(`Collection exceeds maximum export size for ${invocation.geek}`);
        // TODO
    } else {
        const ids = collection.items.map(item => item.gameId);
        console.log(ids);
        // make sure that all of these games are in the database
        // if there are a lot, this lambda might timeout, but next time more of them will be there.
        await dispatchEnsureGames(system, ids);
        console.log(`Collection data size ${JSON.stringify(collection).length}`);
        for (const games of splitCollection(collection)) {
            console.log(`subcollection data size ${JSON.stringify(games).length}`);
            await dispatchProcessCollectionUpdateGames(system, games);
        }
        await cleanupCollection(system, collection, invocation.url);
    }
    return 200;
}

async function cleanupCollection(system: System, collection: ProcessCollectionResult, url: string) {
    const params: CleanUpCollectionResult = {
        geek: collection.geek,
        items: collection.items.map(item => item.gameId),
        url: url
    };
    await dispatchProcessCleanUpCollection(system, params);
}

async function markAsProcessed(system: System, fileDetails: FileToProcess): Promise<void> {
    await dispatchMarkAsProcessed(system, fileDetails);
}

async function markAsUnprocessed(system: System, fileDetails: FileToProcess) {
    await dispatchMarkAsUnprocessed(system, fileDetails);
}

async function markTryAgainTomorrow(system: System, fileDetails: FileToProcess) {
    await dispatchMarkAsTryAgainTomorrow(system, fileDetails);
}

function splitCollection(original: ProcessCollectionResult): ProcessCollectionResult[] {
    return _.chunk(original.items, MAX_GAMES_PER_CALL)
        .map(items => { return { geek: original.geek, items: items }; });
}

export async function processPlayed(invocation: PlaysToProcess) {
    console.log(invocation);
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;
    await initLogging(system, "processPlayed");

    const baseUrl = `https://boardgamegeek.com/xmlapi2/plays?username=${invocation.geek}&type=thing&mindate=${invocation.startYmdInc}&maxdate=${invocation.endYmdInc}&subtype=boardgame&page=`;

    const parser = new XMLParser({
        ignoreAttributes: false, trimValues: true,
        isArray: (name, jpath, isLeafNode, isAttribute) => {
            if (["play","subtype"].indexOf(name) >= 0) return true;
            if (["item","players","subtypes"].indexOf(name) >= 0) return false;
            if (name.startsWith("@_") || name.startsWith("?")) return false;
            console.log(name);
            return false;
        }
    });
    const plays: PlayData[] = [];
    let maxEntries: number | undefined;
    let maxPages = 1000;
    let pageNum = 1;
    while (pageNum <= maxPages) {
        if (pageNum > 1) await sleep(2000);
        const url = baseUrl + pageNum;
        const xml = await fetchXMLFromBGG(system.playsToken, url, invocation);
        if (!xml) {
            console.log(`didn't receive data on page ${pageNum}`);
            await dispatchSlowDown(system);
            return;
        }
        const doc = parser.parse(xml);
        if (maxEntries === undefined) {
            maxEntries = parseInt(doc.plays['@_total']);
            maxPages = Math.floor((maxEntries + 99)/100);
            console.log(`maxEntries=${maxEntries} ${maxPages}`);
        }
        let playCount = 0;
        if (!doc.plays || !doc.plays.play) {
            console.log(`broken on page ${pageNum}`);
            console.log(xml);
            break;
        }
        for (const play of doc.plays.play) {
            const p: PlayData = {
                quantity: parseInt(play['@_quantity']),
                location: play['@_location'],
                date: play['@_date'],
                gameid: parseInt(play.item['@_objectid']),
                id: parseInt(play['@_id'])
            }
            if (p.quantity > 0) plays.push(p);
            playCount++;
        }
        console.log(`Page ${pageNum} ${playCount}`);
        if (playCount === 0) break;
        pageNum++;
    }
    const result: ProcessPlaysForPeriodResult = {
        processMethod: invocation.processMethod,
        plays: plays,
        geek: invocation.geek,
        endYmdInc: invocation.endYmdInc,
        startYmdInc: invocation.startYmdInc,
        url: invocation.url
    }
    console.log(JSON.stringify(result));
    await dispatchPlaysForPeriodResult(system, result);
    await flushLogging();
}

export async function processDesigner(event: FileToProcess) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;
    await initLogging(system, "processDesigner");

    const data = await fetchXMLFromBGG(system.extrasToken, event.url, event);
    // TODO
    console.log(data);
    await flushLogging();
}

export async function processPublisher(event: FileToProcess) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;
    await initLogging(system, "processPublisher");

    const data = await fetchXMLFromBGG(system.extrasToken, event.url, event);
    // TODO
    console.log(data);
    await flushLogging();
}

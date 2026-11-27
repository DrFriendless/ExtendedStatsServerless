import {HttpResponse, isHttpResponse, loadSystem, System} from "./system.mjs";
import {
    ToProcessElement,
    PlayDataResult,
    ProcessPlaysForPeriodResult,
    ContinuationDownloadResponse,
    ContinuationDownloadRequest,
    UpdatePlayedYearsResult,
    DownloadResult,
    URLRequest, PlayedYearsRequest, RequestStats
} from "./interfaces.mjs";
import {
    extractGameDataFromPage,
    extractUserCollectionFromPage,
    extractUserDataFromPage,
    NoSuchGameError
} from "./extraction.mjs";
import {
    dispatchDesignerData, dispatchEnsureGames, dispatchNoSuchDesigner,
    dispatchNoSuchGame, dispatchNoSuchPublisher,
    dispatchPlayedYears, dispatchPlaysForPeriodResult, dispatchProcessCollectionUpdateGames,
    dispatchProcessGameResult,
    dispatchProcessUserResult, dispatchPublisherData, sendToInputQueue, sendToRetryQueue
} from "./dispatch.mjs";
import {between, copyRequestStats, invokeLambdaAsync} from "./library.mjs";
import {cleanupCollection, splitCollection} from "./functions.mjs";
import {XMLParser} from "fast-xml-parser";

// Lambda entry point.
export async function completeProcessUser(event: ContinuationDownloadResponse): Promise<void> {
    const system = await loadSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }
    event.received = new Date().getTime();

    const cx = await extractContinuationDataSingle(system, event);
    if (cx) {
        const stats = copyRequestStats(event);
        const puResult = extractUserDataFromPage(cx.continuationData.geek, cx.continuationData.url, cx.xml, stats);
        console.log(JSON.stringify(puResult));
        puResult.completed = new Date().getTime();
        await dispatchProcessUserResult(system, puResult);
    }
}

export async function completeProcessDesigner(event: ContinuationDownloadResponse): Promise<void> {
    const system = await loadSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }
    event.received = new Date().getTime();

    const cx = await extractContinuationDataSingle(system, event);
    if (cx) {
        const name = between(cx.xml, "<name>", "</name>");
        if (name.length > 0) {
            await dispatchDesignerData(system, { url: cx.continuationData.url, bggid: cx.continuationData.bggid, name, ...copyRequestStats(event, { completed: new Date().getTime() }) });
        } else {
            // e.g. <people termsofuse=\"https://boardgamegeek.com/xmlapi/termsofuse\">\n\t\t<person>\n\t\t<error message=\"Item not found\"/>\n\t</person>\n\t</people>\n\n
            // <people termsofuse="https://boardgamegeek.com/xmlapi/termsofuse"> <person> <error message="Item not found"/> </person> </people>
            // TODO - deal with this
            console.log(cx.xml);
            if (cx.xml.indexOf("Item not found") >= 0) {
                await dispatchNoSuchDesigner(system, cx.continuationData.bggid);
            }
        }
    }
}

export async function completeProcessPublisher(event: ContinuationDownloadResponse): Promise<void> {
    const system = await loadSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }
    event.received = new Date().getTime();

    const cx = await extractContinuationDataSingle(system, event);
    if (cx) {
        const name = between(cx.xml, "<name>", "</name>");
        if (name.length > 0) {
            await dispatchPublisherData(system, { url: cx.continuationData.url, bggid: cx.continuationData.bggid, name, ...copyRequestStats(event, { completed: new Date().getTime() }) });
        } else {
            console.log(cx.xml);
            if (cx.xml.indexOf("Item not found") >= 0) {
                await dispatchNoSuchPublisher(system, cx.continuationData.bggid);
            }
        }
    }
}

// Lambda entry point.
export async function completeProcessCollection(event: ContinuationDownloadResponse): Promise<void> {
    const system = await loadSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }
    event.received = new Date().getTime();
    const stats = copyRequestStats(event);

    const cx = await extractContinuationDataSingle(system, event);
    if (cx) {
        const collection = await extractUserCollectionFromPage(cx.continuationData.geek, cx.xml, cx.continuationData.url, stats);
        if (collection === "InvalidUsername") {
            console.log("Error: Invalid Username");
            // TODO
        } else if (collection === "RateLimitExceeded") {
            console.log("Error: Rate Limit Exceeded");
            // TODO
        } else if (collection === "IncorrectDOM") {
            console.log(`Error: Incorrect DOM for URL ${cx.continuationData.url}`);
            console.log(cx.xml);
        } else if (collection === "ComeBackLater") {
            console.log(`Error: come back later for ${cx.continuationData.geek}`);
            const req = makeDownloadRequest(event.continuationData, "downloader_completeProcessCollection", system.usersToken, event.results[0].url);
            req.attempts = event.attempts;
            await sendToRetryQueue(system, req);
        } else if (collection === "TooBig") {
            console.log(`Error: Collection exceeds maximum export size for ${cx.continuationData.geek}`);
            // TODO
        } else {
            const ids = collection.items.map(item => item.gameId);
            // console.log(ids);
            // make sure that all of these games are in the database
            // if there are a lot, this lambda might timeout, but next time more of them will be there.
            collection.completed = new Date().getTime();
            await dispatchEnsureGames(system, ids);
            // console.log(`Collection data size ${JSON.stringify(collection).length}`);
            for (const games of splitCollection(collection)) {
                // console.log(`subcollection data size ${JSON.stringify(games).length}`);
                await dispatchProcessCollectionUpdateGames(system, games);
            }
            collection.completed = new Date().getTime();
            await cleanupCollection(system, collection, cx.continuationData.url);
        }
    }
}

export async function completeProcessGame(event: ContinuationDownloadResponse): Promise<void> {
    const system = await loadSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }
    event.received = new Date().getTime();
    const stats = copyRequestStats(event, { completed: new Date().getTime() });

    const cx = await extractContinuationDataSingle(system, event);
    if (cx) {
        try {
            const result = await extractGameDataFromPage(cx.continuationData.bggid, cx.continuationData.url, cx.xml, stats);
            await dispatchProcessGameResult(system, result);
        } catch (err) {
            if (err instanceof NoSuchGameError) {
                await dispatchNoSuchGame(system, err.getId());
            } else {
                console.log(err);
            }
        }
    }
}

function newStats(): RequestStats {
    return {
        requestId: crypto.randomUUID(),
        initiated: new Date().getTime(),
        completed: 0,
        downloaded: 0,
        scheduled: 0,
        received: 0
    }
}

function makeDownloadRequest(continuationData: any, functionName: string, token: string, url: string): ContinuationDownloadRequest {
    return {
        type: "continuation",
        functionName,
        continuationData,
        requests: [
            {bggApiKey: token, url }
        ],
        attempts: 0,
        ...newStats()
    };
}

// The tokens don't matter much here, because as long as the requests to BGG are 5 seconds apart we can use the same one for all requests.
export async function prehandle(events: ToProcessElement[]) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;

    console.log(JSON.stringify(events));

    for (const event of events) {
        if (event.processMethod === "processUser") {
            const url = `https://api.geekdo.com/api/users?username=${encodeURIComponent(event.geek)}`;
            // the URL in the continuation data is the URL we were told to download,
            // which will be used to update the file entry in the DB
            // however it may not be the URL we actually need to get the data from.
            const req = makeDownloadRequest({
                geek: event.geek,
                url: event.url
            }, "downloader_completeProcessUser", system.usersToken, url);
            await sendToInputQueue(system, req);
        } else if (event.processMethod === "processDesigner") {
            const req = makeDownloadRequest({
                bggid: event.bggid,
                url: event.url
            }, "downloader_completeProcessDesigner", system.extrasToken, event.url);
            await sendToInputQueue(system, req);
        } else if (event.processMethod === "processPublisher") {
            const req = makeDownloadRequest({
                bggid: event.bggid,
                url: event.url
            }, "downloader_completeProcessPublisher", system.extrasToken, event.url);
            await sendToInputQueue(system, req);
        } else if (event.processMethod === "processGame") {
            const req = makeDownloadRequest({
                bggid: event.bggid,
                url: event.url
            }, "downloader_completeProcessGame", system.gamesToken, event.url);
            await sendToInputQueue(system, req);
        } else if (event.processMethod === "processCollection") {
            const req = makeDownloadRequest({
                geek: event.geek,
                url: event.url
            }, "downloader_completeProcessCollection", system.collectionToken, event.url);
            await sendToInputQueue(system, req);
        } else if (event.processMethod === "processYear") {
            const parts = event.url.split("=");
            const firstPageUrl = `https://boardgamegeek.com/xmlapi2/plays?username=${event.geek}&type=thing&mindate=${parts[0]}&maxdate=${parts[1]}&subtype=boardgame&page=1`;
            const req = makeDownloadRequest({
                geek: event.geek,
                url: event.url,
                startYmdInc: parts[0],
                endYmdInc: parts[1],
                compress: true
            }, "downloader_completeProcessPlays", system.extrasToken, firstPageUrl);
            console.log(JSON.stringify(req));
            await sendToInputQueue(system, req);
        } else if (event.processMethod === "processPlayed") {
            console.log(`* updating played years for ${event.geek} ${event.geekid}`);
            const e: PlayedYearsRequest = { geek: event.geek, geekid: event.geekid, fileId: event.id, ...newStats() };
            await invokeLambdaAsync("downloader_processPlayedYears", e);
        } else {
            console.log("Error: don't know what to do here.");
            // TODO - what else is there?
        }
    }
}

function getMaxPagesFromXml(doc: any) {
    let maxEntries = parseInt(doc.plays['@_total']);
    return Math.floor((maxEntries + 99) / 100);
}

// Lambda entry point.
export async function handleUpdatePlayedYears(event: PlayedYearsRequest) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;

    const thisYear = (new Date()).getFullYear();
    const periods = [
        { start: "0000-0-0", end: "1979-12-31" },
        { start: "1980-0-0", end: "1989-12-31" },
        { start: "1990-0-0", end: "1999-12-31" },
    ];
    let y = 2000;
    while (y <= thisYear) {
        periods.push({ start: `${y}-0-0`, end: `${y}-12-31` });
        y++;
    }
    const nextUpdate = new Date();
    nextUpdate.setFullYear(thisYear + 1);
    nextUpdate.setMonth(0);
    nextUpdate.setDate(2);
    const result: UpdatePlayedYearsResult = {
        geek: event.geek,
        fileId: event.fileId,
        nextUpdate,
        periods,
        ...copyRequestStats(event, { completed: new Date().getTime() })
    };
    console.log(JSON.stringify(result));
    await dispatchPlayedYears(system, result);
}

export async function completeProcessPlays(event: ContinuationDownloadResponse): Promise<void> {
    const system = await loadSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }
    console.log(JSON.stringify(event));
    event.received = new Date().getTime();
    const stats = copyRequestStats(event, { completed: new Date().getTime() });

    const continuationData = event.continuationData;
    console.log(JSON.stringify(continuationData));
    if (continuationData) {
        const goodResultsAlready: DownloadResult[] = [ ...continuationData.results || [], ...(event.results || []).filter(dr => dr.type !== "failure") ];
        const urlsAlready = goodResultsAlready.map(dr => dr.url);
        const baseUrl = `https://boardgamegeek.com/xmlapi2/plays?username=${continuationData.geek}&type=thing&mindate=${continuationData.startYmdInc}&maxdate=${continuationData.endYmdInc}&subtype=boardgame&page=`;

        const urlsToRetrieve: URLRequest[] = [];
        if (!continuationData.maxPages) {
            // this is the first page
            const parser = createXmlParserForPlays();
            const xml = await extractXml(system, event);
            const doc = parser.parse(xml);
            continuationData.maxPages = getMaxPagesFromXml(doc);
        }
        let pageNum = 1;
        console.log(`maxPages=${continuationData.maxPages}`);
        while (pageNum <= continuationData.maxPages) {
            const url = baseUrl + pageNum;
            if (urlsAlready.indexOf(url) >= 0) {
                console.log(`I already have ${url}`);
            } else {
                console.log(`I need to download ${url}`);
                urlsToRetrieve.push({ bggApiKey: system.playsToken, url });
            }
            pageNum++;
        }
        console.log(`URLs to retrieve: ${JSON.stringify(urlsToRetrieve)}`);
        if (urlsToRetrieve.length === 0) {
            await processPlays(system, event, goodResultsAlready);
        } else {
            // go get the rest of the data
            const req: ContinuationDownloadRequest = {
                type: "continuation",
                functionName: "downloader_completeProcessPlays",
                continuationData: { ...continuationData, results: goodResultsAlready },
                requests: urlsToRetrieve,
                requestId: event.requestId,
                attempts: 0,
                ...stats
            };
            await sendToInputQueue(system, req);
        }
    }
}

async function processPlays(system: System, event: ContinuationDownloadResponse, results: DownloadResult[]) {
    console.log("processPlaysSimple");
    console.log(JSON.stringify(results));
    const parser = createXmlParserForPlays();

    const plays: PlayDataResult[] = [];

    for (const dlr of results) {
        const xml = await retrieveXml(system, dlr);
        if (isHttpResponse(xml)) {
            console.log(`Error: could not get XML from ${dlr} - ${JSON.stringify(xml)}`);
            return;
        }
        const doc = parser.parse(xml);
        let playCount = 0;
        if (!doc.plays || !doc.plays.play) {
            console.log(`broken on URL ${dlr.url}`);
            console.log(xml);
            break;
        }
        for (const play of doc.plays.play) {
            const p: PlayDataResult = {
                quantity: parseInt(play['@_quantity']),
                location: play['@_location'],
                date: play['@_date'],
                gameid: parseInt(play.item['@_objectid']),
                id: parseInt(play['@_id'])
            }
            if (p.quantity > 0) plays.push(p);
            playCount++;
        }
        console.log(`URL ${dlr.url} contained ${playCount} plays`);
    }

    // console.log(JSON.stringify(plays));
    const result: ProcessPlaysForPeriodResult = {
        processMethod: "processYear",
        plays: plays,
        geek: event.continuationData.geek,
        endYmdInc: event.continuationData.endYmdInc,
        startYmdInc: event.continuationData.startYmdInc,
        url: event.continuationData.url,
        ...copyRequestStats(event, { completed: new Date().getTime() })
    }
    console.log(JSON.stringify(result));
    await dispatchPlaysForPeriodResult(system, result);
}

async function extractXml(system: System, event: ContinuationDownloadResponse): Promise<string | undefined> {
    const xml = await retrieveXml(system, event.results[0]);
    if (isHttpResponse(xml)) {
        console.log(JSON.stringify(xml));
        return undefined;
    }
    return xml;
}

async function extractContinuationDataSingle(system: System, event: ContinuationDownloadResponse): Promise<{ continuationData: any, xml: string} | undefined> {
    const continuationData = event.continuationData;
    if (!event.results || event.results.length !== 1 || event.results[0].type === "failure") {
        console.log("Data does not look right.");
        console.log(JSON.stringify(event));
        return undefined;
    }
    const xml = await retrieveXml(system, event.results[0]);
    if (isHttpResponse(xml)) {
        console.log(JSON.stringify(xml));
        return undefined;
    }
    return { continuationData, xml };
}

async function retrieveXml(system: System, dlr: DownloadResult): Promise<string | HttpResponse> {
    // console.log(JSON.stringify(dlr));
    switch (dlr.type) {
        case "content": return dlr.content;
        case "failure": return "";
        case "s3": return await system.getObjectFromS3(dlr.bucket, dlr.objectKey);
    }
}

function createXmlParserForPlays() {
    return new XMLParser({
        ignoreAttributes: false, trimValues: true,
        isArray: (name, jpath, isLeafNode, isAttribute) => {
            if (["play", "subtype", "player", "comments"].indexOf(name) >= 0) return true;
            if (["item", "players", "subtypes"].indexOf(name) >= 0) return false;
            if (name.startsWith("@_") || name.startsWith("?")) return false;
            console.log(name);
            return false;
        }
    });
}

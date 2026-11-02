import {HttpResponse, isHttpResponse, loadSystem, System} from "./system.mjs";
import {ToProcessElement} from "extstats-core";
import {SendMessageCommand, SQSClient} from "@aws-sdk/client-sqs";
import {
    ContinuationDownloadRequest,
    ContinuationDownloadResponse,
    DownloadRequest,
    DownloadResult
} from "./interfacesv2.mjs";
import {
    extractGameDataFromPage,
    extractUserCollectionFromPage,
    extractUserDataFromPage,
    NoSuchGameError
} from "./extraction.mjs";
import {
    dispatchDesignerData, dispatchEnsureGames,
    dispatchNoSuchGame, dispatchProcessCollectionUpdateGames,
    dispatchProcessGameResult,
    dispatchProcessUserResult, dispatchPublisherData
} from "./dispatch.mjs";
import {between, copyRequestStats} from "./library.mjs";
import {log} from "./logging.mjs";
import {cleanupCollection, splitCollection} from "./functions.mjs";

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
            const rs = copyRequestStats(event);
            await dispatchDesignerData(system, { url: cx.continuationData.url, bggid: cx.continuationData.bggid, name, ...copyRequestStats(event, { completed: new Date().getTime() }) });
        } else {
            // e.g. <people termsofuse=\"https://boardgamegeek.com/xmlapi/termsofuse\">\n\t\t<person>\n\t\t<error message=\"Item not found\"/>\n\t</person>\n\t</people>\n\n
            console.log(cx.xml);
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
        }
    }
}

export async function completeProcessCollection(event: ContinuationDownloadResponse): Promise<void> {
    const system = await loadSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }
    event.received = new Date().getTime();
    const stats = copyRequestStats(event, { completed: new Date().getTime() });

    const cx = await extractContinuationDataSingle(system, event);
    console.log(JSON.stringify(cx.continuationData));
    if (cx) {
        const collection = await extractUserCollectionFromPage(system, cx.continuationData.geek, cx.xml, cx.continuationData.url, stats);
        if (collection === "InvalidUsername") {
            console.log(400);
            // TODO
        } else if (collection === "RateLimitExceeded") {
            console.log(429);
            // TODO
        } else if (collection === "IncorrectDOM") {
            log(`Incorrect DOM for URL ${cx.continuationData.url}`);
            // TODO
        } else if (collection === "ComeBackLater") {
            await system.loadBGGQueues();
            console.log(202);
            const req = makeDownloadRequest(event.continuationData, "downloader_completeProcessCollection", system.usersToken, event.results[0].url);
            req.attempts = event.attempts;
            await sendToBGGQueue2(system, req);
        } else if (collection === "TooBig") {
            log(`Collection exceeds maximum export size for ${cx.continuationData.geek}`);
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

function makeDownloadRequest(continuationData: any, functionName: string, token: string, url: string): ContinuationDownloadRequest {
    return {
        type: "continuation",
        functionName,
        continuationData,
        requests: [
            {bggApiKey: token, url, notBefore: undefined}
        ],
        requestId: crypto.randomUUID(),
        attempts: 0,
        initiated: new Date().getTime(),
        completed: 0,
        downloaded: 0,
        scheduled: 0,
        received: 0
    };
}

export async function prehandle(event: ToProcessElement) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;
    await system.loadBGGQueues();

    if (event.processMethod === "processUser") {
        const url = `https://api.geekdo.com/api/users?username=${encodeURIComponent(event.geek)}`;
        // the URL in the continuation data is the URL we were told to download,
        // which will be used to update the file entry in the DB
        // however it may not be the URL we actually need to get the data from.
        const req = makeDownloadRequest({ geek: event.geek, url: event.url }, "downloader_completeProcessUser", system.usersToken, url );
        await sendToBGGQueue2(system, req);
    } else if (event.processMethod === "processDesigner") {
        const req = makeDownloadRequest({ bggid: event.bggid, url: event.url }, "downloader_completeProcessDesigner", system.usersToken, event.url );
        await sendToBGGQueue2(system, req);
    } else if (event.processMethod === "processPublisher") {
        const req = makeDownloadRequest({ bggid: event.bggid, url: event.url }, "downloader_completeProcessPublisher", system.usersToken, event.url );
        await sendToBGGQueue2(system, req);
    } else if (event.processMethod === "processGame") {
        const req = makeDownloadRequest({ bggid: event.bggid, url: event.url }, "downloader_completeProcessGame", system.gamesToken, event.url );
        await sendToBGGQueue2(system, req);
    } else if (event.processMethod === "processCollection") {
        console.log(JSON.stringify(event));
        // TODO - change to collectionToken
        const req = makeDownloadRequest({ geek: event.geek, url: event.url }, "downloader_completeProcessCollection", system.usersToken, event.url );
        await sendToBGGQueue2(system, req);
    } else if (event.processMethod !== "processCollection") {
        console.log(JSON.stringify(event));
    } else {
        // TODO - what else is there?
    }
}

async function sendToBGGQueue2(system: System, payload: DownloadRequest): Promise<any> {
    const sqs = new SQSClient({ region: process.env.REGION });
    const command = new SendMessageCommand({
        QueueUrl: system.bggQueue2,
        MessageBody: JSON.stringify(payload),
        MessageGroupId: "pre_handle"
    });
    return await sqs.send(command);
}

// async function sendToBGGQueue1WithDelay(system: System, payload: DownloadRequest, delay: number): Promise<any> {
//     const sqs = new SQSClient({ region: process.env.REGION });
//     console.log(JSON.stringify(system));
//     const command = new SendMessageCommand({
//         QueueUrl: system.bggQueue1,
//         MessageBody: JSON.stringify(payload),
//         DelaySeconds: delay
//     });
//     return await sqs.send(command);
// }

async function extractContinuationDataSingle(system: System, event: ContinuationDownloadResponse): Promise<{ continuationData: any, xml: string} | undefined> {
    const continuationData = event.continuationData;
    if (!event.results || event.results.length !== 1 || event.results[0].type === "failure") {
        console.log("Data does not look right.");
        console.log(JSON.stringify(event));
        return undefined;
    }
    const xml = await retrieveXml(system, event.results[0]);
    console.log(`xml = ${xml}`);
    if (isHttpResponse(xml)) {
        console.log(JSON.stringify(xml));
        return undefined;
    }
    return { continuationData, xml };
}

async function retrieveXml(system: System, dlr: DownloadResult): Promise<string | HttpResponse> {
    console.log(JSON.stringify(dlr));
    switch (dlr.type) {
        case "content": return dlr.content;
        case "failure": return "";
        case "s3": return await system.getObjectFromS3(dlr.bucket, dlr.objectKey);
    }
}


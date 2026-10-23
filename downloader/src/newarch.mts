import {HttpResponse, isHttpResponse, loadSystem, System} from "./system.mjs";
import {
    ToProcessElement,
} from "extstats-core";
import {SendMessageCommand, SQSClient} from "@aws-sdk/client-sqs";
import {
    ContinuationDownloadRequest,
    ContinuationDownloadResponse,
    DownloadRequest,
    DownloadResult
} from "./interfacesv2.mjs";
import {extractGameDataFromPage, extractUserDataFromPage, NoSuchGameError} from "./extraction.mjs";
import {
    dispatchDesignerData,
    dispatchNoSuchGame,
    dispatchProcessGameResult,
    dispatchProcessUserResult, dispatchPublisherData
} from "./dispatch.mjs";
import {between} from "./library.mjs";



export async function completeProcessUser(event: ContinuationDownloadResponse): Promise<void> {
    const system = await loadSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }

    const cx = await extractContinuationDataSingle(system, event);
    if (cx) {
        const puResult = extractUserDataFromPage(cx.continuationData.geek, cx.continuationData.url, cx.xml);
        await dispatchProcessUserResult(system, puResult);
    }
}

export async function completeProcessDesigner(event: ContinuationDownloadResponse): Promise<void> {
    const system = await loadSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }

    const cx = await extractContinuationDataSingle(system, event);
    if (cx) {
        const name = between(cx.xml, "<name>", "</name>");
        if (name.length > 0) {
            await dispatchDesignerData(system, { url: cx.continuationData.url, bggid: cx.continuationData.bggid, name });
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

    const cx = await extractContinuationDataSingle(system, event);
    if (cx) {
        const name = between(cx.xml, "<name>", "</name>");
        if (name.length > 0) {
            await dispatchPublisherData(system, { url: cx.continuationData.url, bggid: cx.continuationData.bggid, name });
        } else {
            console.log(cx.xml);
        }
    }
}

export async function completeProcessGame(event: ContinuationDownloadResponse): Promise<void> {
    const system = await loadSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }

    const cx = await extractContinuationDataSingle(system, event);
    if (cx) {
        try {
            const result = await extractGameDataFromPage(cx.continuationData.bggid, cx.continuationData.url, cx.xml);
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

export async function prehandle(event: ToProcessElement) {
    const system = await loadSystem();
    if (isHttpResponse(system)) return system;

    if (event.processMethod === "processUser") {
        console.log(JSON.stringify(event));
        await system.loadBGGQueues();
        const url = `https://api.geekdo.com/api/users?username=${encodeURIComponent(event.geek)}`;
        const req: ContinuationDownloadRequest = {
            type: "continuation",
            functionName: "downloader_completeProcessUser",
            continuationData: {
                geek: event.geek,
                // this is the URL we were told to download, which will be used to update the file entry in the DB
                // however it may not be the URL we actually need to get the data from.
                url: event.url
            },
            requests: [
                {bggApiKey: system.usersToken, url, notBefore: undefined}
            ],
            requestId: crypto.randomUUID()
        };
        await sendToBGGQueue1(system, req);
    } else if (event.processMethod === "processDesigner") {
        console.log(JSON.stringify(event));
        await system.loadBGGQueues();
        const req: ContinuationDownloadRequest = {
            type: "continuation",
            functionName: "downloader_completeProcessDesigner",
            continuationData: {
                bggid: event.bggid,
                url: event.url
            },
            requests: [
                {bggApiKey: system.usersToken, url: event.url, notBefore: undefined}
            ],
            requestId: crypto.randomUUID()
        };
        await sendToBGGQueue1(system, req);
    } else if (event.processMethod === "processPublisher") {
        console.log(JSON.stringify(event));
        await system.loadBGGQueues();
        const req: ContinuationDownloadRequest = {
            type: "continuation",
            functionName: "downloader_completeProcessPublisher",
            continuationData: {
                bggid: event.bggid,
                url: event.url
            },
            requests: [
                {bggApiKey: system.usersToken, url: event.url, notBefore: undefined}
            ],
            requestId: crypto.randomUUID()
        };
        await sendToBGGQueue1(system, req);
    } else if (event.processMethod === "processGame") {
        console.log(JSON.stringify(event));
        await system.loadBGGQueues();
        const req: ContinuationDownloadRequest = {
            type: "continuation",
            functionName: "downloader_completeProcessGame",
            continuationData: {
                bggid: event.bggid,
                url: event.url
            },
            requests: [
                {bggApiKey: system.gamesToken, url: event.url, notBefore: undefined}
            ],
            requestId: crypto.randomUUID()
        };
        await sendToBGGQueue1(system, req);
    } else if (event.processMethod !== "processCollection") {
        console.log(JSON.stringify(event));
    } else {
        // TODO - handle processCollection
    }
}

async function sendToBGGQueue1(system: System, payload: DownloadRequest): Promise<any> {
    const sqs = new SQSClient({ region: process.env.REGION });
    const command = new SendMessageCommand({
        QueueUrl: system.bggQueue1,
        MessageBody: JSON.stringify(payload)
    });
    return await sqs.send(command);
}

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


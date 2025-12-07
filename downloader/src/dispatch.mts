// methods to send data to the Inside module

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { log } from "./logging.mjs";

const INSIDE_PREFIX = "inside-dev-";

// lambda names we expect to see
const FUNCTION_UPDATE_METADATA = "updateMetadata";
const FUNCTION_UPDATE_TOP50 = "updateBGGTop50";

import {invokeLambdaAsync, splitYmd} from "./library.mjs";
import {
    ProcessGameResult,
    FileToProcess,
    Metadata,
    ProcessCollectionResult,
    ProcessUserResult,
    CleanUpCollectionResult,
    QueueMessage,
    ProcessPlaysForPeriodResult, PlayData
} from 'extstats-core';
import {System} from "./system.mjs";


// Create an Amazon S3 service client object.
const sqsClient = new SQSClient({ region: process.env.REGION });

async function sendToDownloaderQueue(system: System, body: QueueMessage, details: string | undefined = undefined): Promise<void> {
    const b = JSON.stringify(body);
    if (b.length > 260000) {
        // exceed SendMessage size
        log(`SQS message size exceeded: ${b.length} ${body.discriminator} ${details || ""}`);
        return;
    }
    const command = new SendMessageCommand({
        QueueUrl: system.downloaderQueue,
        MessageBody: b,
    });
    await sqsClient.send(command);
}

export async function dispatchUpdateUserList(system: System, users: string[]): Promise<void> {
    await sendToDownloaderQueue(system, { discriminator: "UpdateUserListMessage", users });
}

export async function dispatchEnsureGames(system: System, gameIds: number[]): Promise<void> {
    await sendToDownloaderQueue(system, { discriminator: "EnsureGamesMessage", gameIds });
}

export function dispatchUpdateMetadata(metadata: Metadata): Promise<void> {
    // TODO
    return invokeLambdaAsync(INSIDE_PREFIX + FUNCTION_UPDATE_METADATA, metadata);
}

export function dispatchUpdateTop50(top50: number[]): Promise<void> {
    // TODO
    return invokeLambdaAsync(INSIDE_PREFIX + FUNCTION_UPDATE_TOP50, top50);
}

export function dispatchNoSuchGame(system: System, gameId: number): Promise<void> {
    return sendToDownloaderQueue(system, { discriminator: "NoSuchGameMessage", gameId });
}

export function dispatchNoSuchUser(system: System, geek: string): Promise<void> {
    return sendToDownloaderQueue(system, { discriminator: "NoSuchGeekMessage", geek });
}

export function dispatchSlowDown(system: System): Promise<void> {
    return sendToDownloaderQueue(system, { discriminator: "SlowDownMessage" });
}

export function dispatchProcessGameResult(system: System, result: ProcessGameResult): Promise<void> {
    return sendToDownloaderQueue(system, { discriminator: "GameResultMessage", result }, result.url);
}

export function dispatchProcessUserResult(system: System, result: ProcessUserResult): Promise<void> {
    return sendToDownloaderQueue(system, { discriminator: "UserResultMessage", result }, result.url);
}

export function dispatchProcessCollectionUpdateGames(system: System, result: ProcessCollectionResult): Promise<void> {
    return sendToDownloaderQueue(system, { discriminator: "CollectionResultMessage", result }, result.geek);
}

export async function dispatchMarkAsProcessed(system: System, fileDetails: FileToProcess): Promise<void> {
    await sendToDownloaderQueue(system, { discriminator: "MarkAsProcessedMessage", context: "", fileDetails });
}

export async function dispatchMarkAsUnprocessed(system: System, fileDetails: FileToProcess): Promise<void> {
    await sendToDownloaderQueue(system, { discriminator: "MarkAsUnprocessedMessage", context: "", fileDetails });
}

export async function dispatchMarkAsTryAgainTomorrow(system: System, fileDetails: FileToProcess): Promise<void> {
    await sendToDownloaderQueue(system, { discriminator: "MarkAsTryAgainMessage", context: "", fileDetails });
}

export async function dispatchProcessCleanUpCollection(system: System, params: CleanUpCollectionResult): Promise<void> {
    await sendToDownloaderQueue(system, { discriminator: "CleanUpCollectionMessage", params }, params.url);
}

async function saveToCache(system: System, key: string, body: string) {
    const now = new Date();
    now.setDate(now.getDate() + 180);
    const client = new S3Client({ region: process.env.AWS_REGION });
    const command = new PutObjectCommand({
        Bucket: system.cacheBucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
        Expires: now,
    });
    try {
        const response = await client.send(command);
        console.log(response);
    } catch (error) {
        console.error(error);
    }
}

export async function dispatchPlaysForPeriodResult(system: System, result: ProcessPlaysForPeriodResult): Promise<void> {
    const b = JSON.stringify(result).length;
    if (b > 260000) {
        await saveToCache(system, `${result.geek}=${result.startYmdInc}=${result.endYmdInc}.json`, JSON.stringify(result));
        // break this time period up into multiple.
        const dates: number[] = [];
        const countByDate: Record<string, number> = {};
        const playsByDate: Record<string, PlayData[]> = {};
        for (const p of result.plays) {
            const { y, m, d } = splitYmd(p.date);
            const ymd = y * 10000 + m * 100 + d;
            if (!dates.includes(ymd)) dates.push(ymd);
            const n = countByDate[ymd.toString()] || 0;
            const ps = playsByDate[ymd.toString()] || [];
            countByDate[ymd.toString()] = n + 1;
            ps.push(p);
            playsByDate[ymd.toString()] = ps;
        }
        console.log(countByDate);
        if (Object.keys(countByDate).length === 1) {
            log(`Plays for ${result.url} are concentrated on one day, and have size ${b}`);
            const withoutLocations = removeLocations(result.plays);
            const newResult = { ...result, plays: withoutLocations };
            const b2 = JSON.stringify(newResult).length;
            if (b2 <= 260000) {
                log(`Removing locations for ${result.url}`);
                await sendToDownloaderQueue(system, { discriminator: "PlaysForPeriodResultMessage", plays: newResult }, result.url);
            } else {
                log(`Dropping plays for ${result.url}`);
                await sendToDownloaderQueue(system, { discriminator: "PlaysForPeriodResultMessage", plays: { ...result, plays: [] } }, result.url);
            }
        }
        dates.sort();
        let chunkStart = result.startYmdInc;
        let chunkPlays: PlayData[] = [];
        for (const d of dates) {
            const dPlays = playsByDate[d.toString()];
            const newPlays = chunkPlays.concat(dPlays);
            const b3 = JSON.stringify({...result, plays: newPlays}).length;
            if (b3 > 200000 && chunkPlays.length > 0) {
                // getting very high, emit this chunk
                await emit(result.processMethod, chunkStart, addDashes(yesterday(d)), result.geek, chunkPlays);
                chunkStart = addDashes(d);
                chunkPlays = dPlays;
            } else if (b3 >= 200000 && b3 < 260000 && chunkPlays.length === 0) {
                // this data is very big, emit it.
                await emit(result.processMethod, chunkStart, addDashes(d), result.geek, newPlays);
                chunkStart = addDashes(tomorrow(d));
                chunkPlays = [];
            } else {
                chunkPlays = newPlays;
            }
        }
        if (chunkPlays.length > 0) {
            await emit(result.processMethod, chunkStart, result.endYmdInc, result.geek, chunkPlays);
        }
    } else {
        await sendToDownloaderQueue(system, { discriminator: "PlaysForPeriodResultMessage", plays: result }, result.url);
    }

    function addDashes(ymd: number): string {
        const d = ymd % 100;
        const m = ((ymd - d)  / 100) % 100;
        const y = Math.floor(ymd / 10000);
        return `${y}-${m}-${d}`;
    }

    function yesterday(ymd: number): number {
        const d = ymd % 100;
        const m = ((ymd - d)  / 100) % 100;
        const y = Math.floor(ymd / 10000);
        const date = new Date(y, m-1, d);
        date.setDate(date.getDate() - 1);
        return 10000 * date.getFullYear() + 100 * (date.getMonth() + 1) + date.getDate();
    }

    function tomorrow(ymd: number): number {
        const d = ymd % 100;
        const m = ((ymd - d)  / 100) % 100;
        const y = Math.floor(ymd / 10000);
        const date = new Date(y, m-1, d);
        date.setDate(date.getDate() + 1);
        return 10000 * date.getFullYear() + 100 * (date.getMonth() + 1) + date.getDate();
    }

    async function emit(processMethod: string, symd: string, eymd: string, geek: string, plays: PlayData[]) {
        const url = `${symd}=${eymd}=${geek}`;
        const playsResult: ProcessPlaysForPeriodResult = {
            processMethod, geek, startYmdInc: symd, endYmdInc: eymd, url, plays
        };
        console.log(JSON.stringify(playsResult));
        await sendToDownloaderQueue(system, { discriminator: "PlaysForPeriodResultMessage", plays: playsResult }, url);
    }

    function removeLocations(plays: PlayData[]): PlayData[] {
        return plays.map(p => { return {...p, location: "" }; });
    }
}

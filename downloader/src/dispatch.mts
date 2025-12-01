// methods to send data to the Inside module

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { log } from "./logging.mjs";

const INSIDE_PREFIX = "inside-dev-";

// lambda names we expect to see
const FUNCTION_UPDATE_METADATA = "updateMetadata";
const FUNCTION_UPDATE_TOP50 = "updateBGGTop50";

import {invokeLambdaAsync} from "./library.mjs";
import {
    ProcessGameResult,
    FileToProcess,
    Metadata,
    ProcessCollectionResult,
    MonthPlayedData,
    ProcessUserResult,
    CleanUpCollectionResult,
    QueueMessage,
    ProcessPlaysForPeriodResult
} from 'extstats-core';
import {System} from "./system.mjs";


// Set the AWS Region.
const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY || "", secretAccessKey: process.env.AWS_SECRET_KEY || "" };
// Create an Amazon S3 service client object.
// const sqsClient = new SQSClient({ region: process.env.REGION, credentials: credentials });
const sqsClient = new SQSClient({ region: process.env.REGION });

async function sendToDownloaderQueue(system: System, body: QueueMessage) {
    const b = JSON.stringify(body);
    if (b.length > 260000) {
        // exceed SendMessage size
        log(`SQS message size exceeded: ${b.length} ${body.discriminator}`);
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
    return sendToDownloaderQueue(system, { discriminator: "GameResultMessage", result });
}

export function dispatchProcessUserResult(system: System, result: ProcessUserResult): Promise<void> {
    return sendToDownloaderQueue(system, { discriminator: "UserResultMessage", result });
}

export function dispatchProcessCollectionUpdateGames(system: System, result: ProcessCollectionResult): Promise<void> {
    return sendToDownloaderQueue(system, { discriminator: "CollectionResultMessage", result });
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
    await sendToDownloaderQueue(system, { discriminator: "CleanUpCollectionMessage", params });
}

export async function dispatchProcessPlayedResult(system: System, monthsData: MonthPlayedData): Promise<void> {
    await sendToDownloaderQueue(system, { discriminator: "PlayedResultMessage", monthsData });
}

export async function dispatchPlaysForPeriodResult(system: System, result: ProcessPlaysForPeriodResult): Promise<void> {
    await sendToDownloaderQueue(system, { discriminator: "PlaysForPeriodResultMessage", plays: result });
}

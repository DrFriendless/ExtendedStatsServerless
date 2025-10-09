// methods to send data to the Inside module

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const INSIDE_PREFIX = "inside-dev-";

// lambda names we expect to see
const FUNCTION_UPDATE_METADATA = "updateMetadata";
const FUNCTION_UPDATE_TOP50 = "updateBGGTop50";
const FUNCTION_PROCESS_PLAYED_RESULT = "processPlayedMonthsResult";
const FUNCTION_PROCESS_PLAYS_RESULT = "processPlaysResult";
const FUNCTION_PROCESS_GAME_RESULT = "processGameResult";
const FUNCTION_NO_SUCH_GAME = "updateGameAsDoesNotExist";
const FUNCTION_PROCESS_COLLECTION_UPDATE_GAMES = "processCollectionUpdateGames";
const FUNCTION_PROCESS_COLLECTION_CLEANUP = "processCollectionCleanup";
const FUNCTION_MARK_PROCESSED = "updateUrlAsProcessed";
const FUNCTION_MARK_UNPROCESSED = "updateUrlAsUnprocessed";
const FUNCTION_MARK_TOMORROW = "updateUrlAsTryTomorrow";

import {invokeLambdaAsync, invokeLambdaSync} from "./library.mjs";
import {
    ProcessGameResult, FileToProcess, Metadata, ProcessCollectionResult,
    MonthPlayedData, ProcessPlaysResult, ProcessUserResult, CleanUpCollectionResult, QueueMessage
} from 'extstats-core';
import {System} from "./system.mjs";


// Set the AWS Region.
const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY || "", secretAccessKey: process.env.AWS_SECRET_KEY || "" };
// Create an Amazon S3 service client object.
// const sqsClient = new SQSClient({ region: process.env.REGION, credentials: credentials });
const sqsClient = new SQSClient({ region: process.env.REGION });

async function sendToDownloaderQueue(system: System, body: QueueMessage) {
    const command = new SendMessageCommand({
        QueueUrl: system.downloaderQueue,
        MessageBody: JSON.stringify(body),
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

export function dispatchNoSuchGame(gameId: number): Promise<void> {
    // TODO
    return invokeLambdaAsync(INSIDE_PREFIX + FUNCTION_NO_SUCH_GAME, {bggid: gameId});
}

export function dispatchNoSuchUser(system: System, geek: string): Promise<void> {
    return sendToDownloaderQueue(system, { discriminator: "NoSuchGeekMessage", geek });
}

export function dispatchProcessGameResult(result: ProcessGameResult): Promise<void> {
    // TODO
    return invokeLambdaAsync(INSIDE_PREFIX + FUNCTION_PROCESS_GAME_RESULT, result);
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

export function dispatchProcessPlayedResult(system: System, monthsData: MonthPlayedData): Promise<void> {
    // TODO
    return invokeLambdaAsync(INSIDE_PREFIX + FUNCTION_PROCESS_PLAYED_RESULT, monthsData);
}

export function dispatchProcessPlaysResult(system: System, result: ProcessPlaysResult): Promise<void> {
    // TODO
    if (result.plays.length > 2000) {
        // synchronous invocations can take a much larger payload than async ones, and around 2000 plays we hit the limit.
        // https://www.stackery.io/blog/RequestEntityTooLargeException-aws-lambda-message-invocation-limits/
        return invokeLambdaSync(INSIDE_PREFIX + FUNCTION_PROCESS_PLAYS_RESULT, result)
            .then();
    } else {
        return invokeLambdaAsync(INSIDE_PREFIX + FUNCTION_PROCESS_PLAYS_RESULT, result);
    }
}
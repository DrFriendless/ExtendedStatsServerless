import {isHttpResponse, loadSystem, System} from "./system.mjs";
import {DurableContext, DurableLogger, withDurableExecution} from "@aws/durable-execution-sdk-js";
import {DeleteMessageCommand, SendMessageCommand, SQSClient} from "@aws-sdk/client-sqs";
import {log} from "./logging.mjs";
import { LambdaClient, SendDurableExecutionCallbackFailureCommand, SendDurableExecutionCallbackSuccessCommand } from "@aws-sdk/client-lambda";

export interface BGGDownloadRequest {
    bggApiKey: string;
    fileUrl: string;
    callbackId: string;
}

interface DurableEvent {
    Records: {
        messageId: string;
        receiptHandle: string;
        body: string;
        attributes: object;
        messageAttributes: {};
        md5OfBody: string;
        eventSource: string;
        eventSourceArn: string;
        awsRegion: string;
    }[];
}

// https://dev.to/gunnargrosch/aws-lambda-durable-functions-building-long-running-workflows-in-code-1ad3

export const handler = withDurableExecution(
    async (event: DurableEvent, context: DurableContext<DurableLogger>) => {
        const system = await loadSystem();
        if (isHttpResponse(system)) return system;

        const { waitInMillis, bggQueue } = await context.step("calc-next-time", async () => {
            await system.loadBGGQueueOwnParameters();
            await system.loadBGGQueueUserParameters();
            return { waitInMillis: system.lastRequestTime + 5000 - new Date().getTime(), bggQueue: system.bggQueue }
        });

        if (waitInMillis > 0) {
            await context.wait("wait-till-next-time", { seconds: waitInMillis / 1000 });
        }
        await context.step("write-request-time", async () => {
            await system.updateLastRequestTime(new Date().getTime());
        });

        const lambdaClient = new LambdaClient({});
        const sqsClient = new SQSClient({});
        const tasks = event.Records.map((r, index) => {
            return { request: JSON.parse(r.body), receiptHandle: r.receiptHandle, index: index };
        });

        for (const { request, receiptHandle, index } of tasks) {
            context.logger.info(JSON.stringify(request));
            const xml = await context.step("download", () => fetchXMLFromBGG(request.bggApiKey, request.fileUrl));
            context.logger.info(xml);

            const delResp = await context.step(`delete-message-${index}`, async () => {
                const command = new DeleteMessageCommand({
                    QueueUrl: bggQueue,
                    ReceiptHandle: receiptHandle
                });
                const response = await sqsClient.send(command);
                if (response.$metadata.httpStatusCode !== 200) {
                    context.logger.error(JSON.stringify(response));
                }
            });

            await context.step(`send-callback-${index}`, async () => {
                if (xml === undefined) {
                    const command = new SendDurableExecutionCallbackFailureCommand({ CallbackId: request.callbackId, Error: { ErrorMessage: "Rate limit exceeded" } });
                    await lambdaClient.send(command);
                } else {
                    const command = new SendDurableExecutionCallbackSuccessCommand({ CallbackId: request.callbackId, Result: xml });
                    await lambdaClient.send(command);
                }
            });
        }
    });

export const test = withDurableExecution(
    async (event, context: DurableContext<DurableLogger>) => {
        const system = await loadSystem();
        if (isHttpResponse(system)) return system;
        await system.loadBGGQueueUserParameters();

        const geek = "Friendless";
        const startYmdInc = "2026-0-0";
        const endYmdInc = "2026-0-0";
        const pageNum = 1;
        const url = `https://boardgamegeek.com/xmlapi2/plays?username=${geek}&type=thing&mindate=${startYmdInc}&maxdate=${endYmdInc}&subtype=boardgame&page=${pageNum}`;

        const [callbackPromise, callbackId] = await context.createCallback("load-url", { timeout: { days: 1 } });

        const result = await context.step("get-from-queue", async () => {
            const request = { bggApiKey: system.playsToken, fileUrl: url, callbackId };
            context.logger.info(JSON.stringify(request));
            await sendToBGGQueue(system, context, request);
            return callbackPromise;
        });

        context.logger.info(result);
    });

async function sendToBGGQueue(system: System, context: DurableContext<DurableLogger>, payload: BGGDownloadRequest): Promise<void> {
    const sqs = new SQSClient({ region: process.env.REGION });
    const command = new SendMessageCommand({
        QueueUrl: system.bggQueue,
        MessageBody: JSON.stringify(payload)
    });
    try {
        const resp = await sqs.send(command);
    } catch (error) {
        context.logger.error(error);
    }
}

async function fetchXMLFromBGG(token: string, url: string): Promise<string | undefined> {
    const resp = await fetch(url, {
        headers: {
            "Accept": "application/xml",
            "Authorization": `Bearer ${token}`,
        }
    });
    const xml = await resp.text();
    if (xml.indexOf("Rate limit exceeded") >= 0) {
        log(`Rate limit exceeded downloading ${url}`);
        return undefined;
    }
    return xml;
}
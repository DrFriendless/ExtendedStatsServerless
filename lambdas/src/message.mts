import {QueueInput, WebsockMessage,} from "./interfaces.mjs";
import { DynamoDBClient} from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import {DeleteMessageCommand, SQSClient} from "@aws-sdk/client-sqs";
import {findSystem, isHttpResponse} from "./system.mjs";
import {
    DynamoDBDocumentClient,
    QueryCommand,
    DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

const CONNECTION_TABLE = "websocket_connections";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });
const apigwApi = new ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: `https://socks.drfriendless.com`,
});

async function promiseToSend(geek: string, connectionId: string, data: any, docClient: DynamoDBDocumentClient): Promise<void> {
    console.log(`sending ${JSON.stringify(data)} to ${connectionId}`);
    try {
        await apigwApi.postToConnection({ConnectionId: connectionId, Data: JSON.stringify(data)});
    } catch (err) {
        if (err.statusCode === 410 || err.$metadata?.httpStatusCode === 410) {
            console.log(`Found stale connection, deleting ${connectionId}`);
            const delCmd = new DeleteCommand({ TableName: CONNECTION_TABLE, Key: { geek, connectionId } });
            const delResp = await docClient.send(delCmd);
            console.log(delResp);
        } else {
            console.error("Error postToConnection");
            console.error(err);
        }
    }
}

export async function handler(queueEvent: QueueInput): Promise<void> {
    const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
    const docClient = DynamoDBDocumentClient.from(ddbClient, {
        marshallOptions: {
            removeUndefinedValues: true,
            convertEmptyValues: false
        }
    });

    console.log(JSON.stringify(queueEvent));
    const system = await findSystem(["message"]);
    if (isHttpResponse(system)) return;

    const postCalls: Promise<void>[] = [];
    for (const record of queueEvent.Records) {
        const command = new DeleteMessageCommand({
            QueueUrl: system.messageQueue,
            ReceiptHandle: record.receiptHandle
        });
        await sqsClient.send(command);
        const event: WebsockMessage = JSON.parse(record.body);
        for (const geek of event.users) {
            try {
                const queryResult = await docClient.send(new QueryCommand({
                    TableName: CONNECTION_TABLE,
                    KeyConditionExpression: "geek = :geek",
                    ExpressionAttributeValues: { ':geek': geek },
                    ProjectionExpression: "topics,connectionId"
                }));
                for (const item of queryResult.Items) {
                    const itemTopics: Set<string> = item.topics;
                    // filter by topic
                    let send = itemTopics.has(".");
                    if (!send) {
                        for (const t of event.topics) {
                            if (itemTopics.has(t)) {
                                send = true;
                                break;
                            }
                        }
                    }
                    // maybe send the message
                    if (send) {
                        await promiseToSend(geek, item.connectionId, event.body, docClient);
                    }
                }
            } catch (err) {
                console.error(`Error query <${geek}>`);
                console.error(err);
                return;
            }
        }
    }
    if (postCalls.length > 0) {
        try {
            const result = await Promise.allSettled(postCalls);
            console.log("settled");
            for (const v of result) {
                console.log(v);
            }
        } catch (err) {
            console.error(err);
        }
    }
    docClient.destroy();
    ddbClient.destroy();
}
import {QueueInput, WebsockMessage,} from "./interfaces.mjs";
import {AttributeValue, DeleteItemCommand, DynamoDBClient, QueryCommand} from "@aws-sdk/client-dynamodb";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";
import {DeleteMessageCommand, SQSClient} from "@aws-sdk/client-sqs";
import {findSystem, isHttpResponse} from "./system.mjs";

const CONNECTION_TABLE = "websocket_connections";

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });
const apigwApi = new ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: `https://socks.drfriendless.com`,
});

async function promiseToSend(connectionId: AttributeValue, data: any): Promise<void> {
    console.log(`sending ${JSON.stringify(data)} to ${connectionId.S}`);
    try {
        await apigwApi.postToConnection({ConnectionId: connectionId.S, Data: JSON.stringify(data)});
    } catch (err) {
        console.log("Error postToConnection");
        console.log(err);
        if (err.statusCode === 410) {
            console.log(`Found stale connection, deleting ${connectionId.S}`);
            const delCmd = new DeleteItemCommand({ TableName: CONNECTION_TABLE, Key: { connectionId } });
            const delResp = await ddbClient.send(delCmd);
            console.log(delResp);
        }
    }
}

export async function handler(queueEvent: QueueInput): Promise<void> {
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
            const queryCommand = new QueryCommand({
                TableName: CONNECTION_TABLE,
                KeyConditionExpression: "geek = :geek",
                ExpressionAttributeValues: { ":geek": { S: geek } }
            });
            try {
                const queryResult = await ddbClient.send(queryCommand);
                for (const item of queryResult.Items) {
                    // filter by topic
                    let send = item.topics.SS.indexOf(".") >= 0;
                    if (!send) {
                        for (const t of event.topics) {
                            if (item.topics.SS.indexOf(t) >= 0) {
                                send = true;
                                break;
                            }
                        }
                    }
                    // maybe send the message
                    if (send) {
                        // postCalls.push(promiseToSend(item.connectionId, event.body));
                        await promiseToSend(item.connectionId, event.body);
                    }
                }
            } catch (err) {
                console.log("Error query");
                console.log(err);
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
            console.log(err);
        }
    }
}
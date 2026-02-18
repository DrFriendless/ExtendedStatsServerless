import { APIGatewayProxyEvent } from 'aws-lambda';
import {
    DeleteItemCommand,
    DeleteItemCommandOutput,
    DynamoDBClient,
    PutItemCommand,
    PutItemCommandOutput, ScanCommand, ScanCommandOutput,
    QueryCommand
} from "@aws-sdk/client-dynamodb";
import {
    ApiGatewayManagementApi,
} from "@aws-sdk/client-apigatewaymanagementapi";
import crypto from "crypto";

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const GEEK_TABLE = "geek_connections";
const CONNECTION_TABLE = "websocket_connections";

export async function getChatterCode(geek: string): Promise<string> {
    const queryCommand = new QueryCommand({
        TableName: GEEK_TABLE,
        KeyConditionExpression: "geek = :geek",
        ExpressionAttributeValues: { ":geek": { S: geek } }
    });
    console.log(JSON.stringify(queryCommand));
    const queryResult = await ddbClient.send(queryCommand);
    console.log(JSON.stringify(queryResult));
    if (queryResult.Items.length > 0) {
        // TODO - update accessed time
        return queryResult.Items[0].uuid.S;
    }

    let uuid = crypto.randomUUID();
    const now = (new Date()).getTime().toString();
    const putCommand = new PutItemCommand({
        TableName: GEEK_TABLE,
        Item: {
            geek: { S: geek },
            uuid: { S: uuid },
            created: { N: now },
            accessed: { N: now }
        },
    });
    const putResult = await ddbClient.send(putCommand);
    return uuid;
}

export async function connectHandler(event: APIGatewayProxyEvent) {
    console.log(JSON.stringify(event));
    const tableName = CONNECTION_TABLE;
    // TODO - look for cookie
    const cmd = new PutItemCommand({
        TableName: tableName,
        Item: {
            connectionId: { S: event.requestContext.connectionId },
            domainName: { S: event.requestContext.domainName },
            stage: { S: event.requestContext.stage }
        },
    });
    try {
        const resp: PutItemCommandOutput = await ddbClient.send(cmd);
        console.log(JSON.stringify(resp));
    } catch (err) {
        return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
    }
    return { statusCode: 200, body: 'Connected.' };
}

export async function disconnectHandler(event: APIGatewayProxyEvent) {
    console.log(JSON.stringify(event));
    const tableName = CONNECTION_TABLE;
    const cmd = new DeleteItemCommand({
        TableName: tableName,
        Key: {
            connectionId: { S: event.requestContext.connectionId },
        },
    });
    try {
        const resp: DeleteItemCommandOutput = await ddbClient.send(cmd);
        console.log(resp);
    } catch (err) {
        return { statusCode: 500, body: 'Failed to disconnect: ' + JSON.stringify(err) };
    }
    return { statusCode: 200, body: 'Disconnected.' };
}

export async function messageHandler(event: APIGatewayProxyEvent) {
    console.log(JSON.stringify(event));
    const tableName = CONNECTION_TABLE;
    if (!event.body) {
        throw new Error('event body is missing');
    }

    let connectionData;
    const cmd = new ScanCommand({
        TableName: tableName,
        ProjectionExpression: 'connectionId'
    });
    try {
        const resp: ScanCommandOutput = await ddbClient.send(cmd);
        console.log(resp);
        connectionData = resp;
    } catch (err) {
        console.log(err);
        return;
    }
    const apigwApi = new ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: `https://${event.requestContext.domainName}`,
    });

    const postData = JSON.parse(event.body).data;
    console.log(JSON.stringify(postData));

    const postCalls = (connectionData.Items ?? []).map(async ({ connectionId }) => {
        try {
            console.log(`sending to ${connectionId.S}`);
            const opt = await apigwApi.postToConnection({ConnectionId: connectionId.S, Data: postData});
            console.log(opt);
            return;
        } catch (e) {
            console.log(e);
            if (e.statusCode === 410) {
                console.log(`Found stale connection, deleting ${connectionId}`);
                const delCmd = new DeleteItemCommand({ TableName: tableName, Key: { connectionId} });
                const delResp = await ddbClient.send(delCmd);
                console.log(delResp);
            } else {
                throw e;
            }
        }
    });

    try {
        await Promise.all(postCalls);
        console.log(`${postCalls.length} promises completed`);
    } catch (e) {
        return { statusCode: 500, body: e.stack };
    }

    return { statusCode: 200, body: 'Data sent.' };
}
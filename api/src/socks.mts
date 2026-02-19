import { APIGatewayProxyEvent } from 'aws-lambda';
import {
    DeleteItemCommand,
    DeleteItemCommandOutput,
    DynamoDBClient,
    PutItemCommand,
    PutItemCommandOutput, ScanCommand, ScanCommandOutput,
    QueryCommand, UpdateItemCommand, GetItemCommand, GetItemCommandOutput
} from "@aws-sdk/client-dynamodb";
import {
    ApiGatewayManagementApi,
} from "@aws-sdk/client-apigatewaymanagementapi";
import crypto from "crypto";

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const GEEK_TABLE = "geek_connections";
const CONNECTION_TABLE = "websocket_connections";

async function verifyChatterCode(geek: string, chatterCode: string): Promise<boolean> {
    const queryCommand = new GetItemCommand({
        TableName: GEEK_TABLE,
        Key: {
            geek: { S: geek },
            uuid: { S: chatterCode }
        },
    });
    console.log(JSON.stringify(queryCommand));
    const queryResult: GetItemCommandOutput = await ddbClient.send(queryCommand);
    console.log(JSON.stringify(queryResult));
    if (queryResult.Item) {
        await updateAccessTime(geek, chatterCode);
        return true;
    }
    return false;
}

async function updateAccessTime(geek: string, chatterCode: string): Promise<void> {
    const updateCommand = new UpdateItemCommand({
        TableName: GEEK_TABLE,
        Key: {
            geek: { S: geek },
            uuid: { S: chatterCode }
        },
        ExpressionAttributeValues: { ":accessed": { N: (new Date()).getTime().toString() } },
        UpdateExpression: "SET accessed = :accessed",
    });
    try {
        const resp = await ddbClient.send(updateCommand);
        console.log(JSON.stringify(resp));
    } catch (err) {
        console.log(err);
    }
}

export async function getExistingChatterCode(geek: string): Promise<string | undefined> {
    const now = new Date();
    const old = now.getTime() - 3600000;
    const queryCommand = new QueryCommand({
        TableName: GEEK_TABLE,
        KeyConditionExpression: "geek = :geek",
        ExpressionAttributeValues: { ":geek": { S: geek } }
    });
    const queryResult = await ddbClient.send(queryCommand);
    console.log(JSON.stringify(queryResult));
    for (const item of queryResult.Items) {
        const deleteCommand = new DeleteItemCommand({
            TableName: GEEK_TABLE,
            Key: {
                geek: item.geek,
                uuid: item.uuid
            },
            ConditionExpression: "accessed < :old",
            ExpressionAttributeValues: { ":old": { N: old.toString() } }
        });
        try {
            const resp: DeleteItemCommandOutput = await ddbClient.send(deleteCommand);
            console.log(JSON.stringify(resp));
        } catch (err) {
            // ignore CondtionalCheckFailed
        }
    }
    const queryResult2 = await ddbClient.send(queryCommand);
    if (queryResult2.Items.length > 0) {
        const item = queryResult2.Items[0];
        const result = item.uuid.S;
        await updateAccessTime(item.geek.S, result);
        return result;
    }
    return undefined;
}

export async function getChatterCode(geek: string): Promise<string> {
    const existing = await getExistingChatterCode(geek);
    if (existing) return existing;
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
    console.log(JSON.stringify(putResult))
    return uuid;
}

export async function connectHandler(event: APIGatewayProxyEvent) {
    console.log(JSON.stringify(event));
    // TODO - check authority to connect
    const geek = event.queryStringParameters["geek"];
    const id = event.queryStringParameters["id"];
    if (!geek || !id) {
        return { statusCode: 403 };
    }
    // check that the code is correct
    if (!await verifyChatterCode(geek, id)) {
        console.log("verification failed");
        return { statusCode: 403 };
    }
    //
    const cmd = new PutItemCommand({
        TableName: CONNECTION_TABLE,
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
        console.log(JSON.stringify(err));
        return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
    }
    return { statusCode: 200, body: 'Connected.' };
}

export async function disconnectHandler(event: APIGatewayProxyEvent) {
    console.log(JSON.stringify(event));
    const cmd = new DeleteItemCommand({
        TableName: CONNECTION_TABLE,
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
    if (!event.body) {
        throw new Error('event body is missing');
    }

    let connectionData;
    const cmd = new ScanCommand({
        TableName: CONNECTION_TABLE,
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
                const delCmd = new DeleteItemCommand({ TableName: CONNECTION_TABLE, Key: { connectionId} });
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
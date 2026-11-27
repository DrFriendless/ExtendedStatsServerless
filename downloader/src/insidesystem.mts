import {HttpResponse, isHttpResponse} from "./system.mjs";
import * as sqs from "@aws-sdk/client-sqs";
import * as mysql from 'promise-mysql';
import {AbstractDownloadRequest, WebsockMessage} from "./interfaces.mjs";

export async function loadInsideSystem() {
    const s = new InsideSystem();
    if (isHttpResponse(s)) return s;
    await s.loadDatabaseSecrets();
    return s;
}

/**
 * The equivalent of the System class for Lambdas inside the VPC.
 * These Lambdas are different in that they will have access to the database, but not to Secrets Manager etc, so
 * rather than shoehorn them into the same class they can have their own.
 */
export class InsideSystem {
    private mysqlHost: string | undefined;
    private mysqlUsername: string | undefined;
    private mysqlPassword: string | undefined;
    private mysqlDatabase: string | undefined;
    public retryQueue: string | undefined;
    private messageQueue: string | undefined;
    public inputQueue: string | undefined;
    private readonly sqsClient =
        new sqs.SQSClient({
            region: process.env.REGION,
            useDualstackEndpoint: true,
        });

    async loadDatabaseSecrets(): Promise<HttpResponse | void> {
        this.mysqlHost = process.env.MYSQL_HOST;
        this.mysqlUsername = process.env.MYSQL_USERNAME;
        this.mysqlPassword = process.env.MYSQL_PASSWORD;
        this.mysqlDatabase = process.env.MYSQL_DATABASE;
        this.retryQueue = process.env.RETRY_QUEUE;
        this.messageQueue = process.env.MESSAGE_QUEUE;
        this.inputQueue = process.env.INPUT_QUEUE;
    }

    async getConnection(): Promise<mysql.Connection> {
        const params = {
            host: this.mysqlHost,
            user: this.mysqlUsername,
            password: this.mysqlPassword,
            database: this.mysqlDatabase
        };
        return mysql.createConnection(params);
    }

    async asyncReturnWithConnection<T>(func: (conn: mysql.Connection) => PromiseLike<T>): Promise<T> {
        const connection = await this.getConnection();
        try {
            return await func(connection);
        } finally {
            if (connection) connection.destroy();
        }
    }

    async asyncWithConnection(func: (conn: mysql.Connection) => PromiseLike<void>): Promise<void> {
        const connection = await this.getConnection();
        try {
            await func(connection);
        } finally {
            if (connection) connection.destroy();
        }
    }

    async receiveFromRetry(): Promise<AbstractDownloadRequest[]> {
        const response = await this.sqsClient.send(
            new sqs.ReceiveMessageCommand({
                QueueUrl: this.retryQueue,
                MaxNumberOfMessages: 10,
                WaitTimeSeconds: 1,      // long polling
                VisibilityTimeout: 600,   // optional; overrides the queue default
            })
        );
        const results: AbstractDownloadRequest[] = [];
        const messages = response.Messages ?? [];
        for (const msg of messages) {
            console.log(msg.MessageId, msg.Body);
            results.push(JSON.parse(msg.Body));
            await this.sqsClient.send(new sqs.DeleteMessageCommand({ QueueUrl: this.retryQueue, ReceiptHandle: msg.ReceiptHandle }));
        }
        return results;
    }

    async sendMessage(geeks: string[], topics: string[], body: any): Promise<void> {
        const payload: WebsockMessage = { body, topics, users: geeks };
        const command = new sqs.SendMessageCommand({
            QueueUrl: this.messageQueue,
            MessageBody: JSON.stringify(payload)
        });
        try {
            const resp = await this.sqsClient.send(command);
        } catch (error) {
            console.log(error);
        }
    }

    async sendToQueueWithDelay(queueUrl: string, payload: any, delay: number): Promise<void> {
        const command = new sqs.SendMessageCommand({
            QueueUrl: queueUrl,
            DelaySeconds: delay,
            MessageBody: JSON.stringify(payload)
        });
        try {
            const resp = await this.sqsClient.send(command);
        } catch (error) {
            console.log(error);
        }
    }
}
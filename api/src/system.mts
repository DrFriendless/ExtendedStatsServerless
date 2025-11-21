import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import * as mysql from "promise-mysql";

export async function findSystem(): Promise<System | HttpResponse> {
    const sys = new System();
    return await sys.loadSecrets();
}

export class System {
    private readonly secretName: string;
    private mysqlHost: string | undefined;
    private mysqlUsername: string | undefined;
    private mysqlPassword: string | undefined;
    private mysqlDatabase: string | undefined;

    constructor() {
        this.secretName = "/extstats/database";
    }

    async loadSecrets(): Promise<System | HttpResponse> {
        const client = new SecretsManagerClient({
            region: process.env.AWS_REGION
        });
        try {
            const response = await client.send(
                new GetSecretValueCommand({
                    SecretId: this.secretName
                })
            );
            const secret = response.SecretString;
            const obj = JSON.parse(secret);
            this.mysqlHost = obj.mysqlHost;
            this.mysqlUsername = obj.mysqlUsername;
            this.mysqlPassword = obj.mysqlPassword;
            this.mysqlDatabase = obj.mysqlDatabase;
            return this;
        } catch (error) {
            console.log(error);
            return { "statusCode": 500, "body": JSON.stringify({ error: `Can't find secret ${this.secretName} - make sure it exists in AWS.` })}
        }
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
}

export interface HttpResponse {
    statusCode: number;
    body?: string;
    headers?: Record<string, any>;
}

export function isHttpResponse(object: any): object is HttpResponse {
    return 'statusCode' in object;
}
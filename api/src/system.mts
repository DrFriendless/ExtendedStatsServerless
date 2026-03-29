import * as mysql from "promise-mysql";
import {APIGatewayProxyEventV2WithRequestContext} from "aws-lambda/trigger/api-gateway-proxy.js";
import {getUserFromEvent} from "./library.mjs";
import {PUBLIC_PRIVATE} from "./geeklist.mjs";
import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";

export async function findSystem(pp: PUBLIC_PRIVATE, event: APIGatewayProxyEventV2WithRequestContext<any> | undefined = undefined): Promise<System | HttpResponse> {
    const sys = new System();
    if (event) sys.user = getUserFromEvent(event);
    return await sys.loadSecrets(pp);
}

const BGG_SECRETS = "extstats/bgg";

export class System {
    private mysqlHost: string | undefined;
    private mysqlUsername: string | undefined;
    private mysqlPassword: string | undefined;
    private mysqlDatabase: string | undefined;
    geeklistToken: string | undefined;
    user: string | undefined;

    async loadSecrets(pp: PUBLIC_PRIVATE): Promise<System | HttpResponse> {
        if (pp === "public") {
            return this.loadBGGSecrets();
        } else {
            this.mysqlHost = process.env.MYSQL_HOST;
            this.mysqlUsername = process.env.MYSQL_USERNAME;
            this.mysqlPassword = process.env.MYSQL_PASSWORD;
            this.mysqlDatabase = process.env.MYSQL_DATABASE;
        }
        return this;
    }

    async loadBGGSecrets(): Promise<HttpResponse | System> {
        const client = new SecretsManagerClient({
            region: process.env.AWS_REGION
        });
        try {
            const response = await client.send(
                new GetSecretValueCommand({
                    SecretId: BGG_SECRETS
                })
            );
            const secret = response.SecretString;
            const obj = JSON.parse(secret);
            this.geeklistToken = obj.geeklist_token;
        } catch (error) {
            console.log(error);
            return {
                "statusCode": 500,
                "body": JSON.stringify({error: `Can't find secret ${BGG_SECRETS} - make sure it exists in AWS.`})
            }
        }
        return this;
    }

    async getConnection(): Promise<mysql.Connection> {
        const params = {
            host: this.mysqlHost,
            user: this.mysqlUsername,
            password: this.mysqlPassword,
            database: this.mysqlDatabase,
            charset: 'utf8mb4'
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

    async incrementApiCounter() {
        await this.asyncWithConnection(async conn => conn.query("update counters set api_calls = api_calls + 1"));
    }
}

export interface HttpResponse {
    statusCode: number;
    body?: string;
    headers?: Record<string, any>;
    cookies?: string[];
}

export function isHttpResponse(object: any): object is HttpResponse {
    if (typeof object !== "object") return false;
    return 'statusCode' in object;
}
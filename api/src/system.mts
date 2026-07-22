import * as mysql from "promise-mysql";
import {APIGatewayProxyEventV2WithRequestContext} from "aws-lambda/trigger/api-gateway-proxy.js";
import {PUBLIC_PRIVATE} from "./geeklist.mjs";
import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import {getCookiesFromEvent} from "./library.mjs";
import {loadAuth} from "./authdb.mjs";
import {checkPassword, getUserFromSecureCookie, SecureUserData} from "./auth.mjs";

export async function findSystem(pp: PUBLIC_PRIVATE, event: APIGatewayProxyEventV2WithRequestContext<any> | undefined): Promise<System | HttpResponse> {
    const sys = new System();
    const s0 = await sys.loadSecrets(pp);
    if (isHttpResponse(s0)) return s0;
    await sys.loadSecureUserData(event);
    return sys;
}

const BGG_SECRETS = "extstats/bgg";

export class System {
    private mysqlHost: string | undefined;
    private mysqlUsername: string | undefined;
    private mysqlPassword: string | undefined;
    private mysqlDatabase: string | undefined;
    geeklistToken: string | undefined;
    secureUser: string | undefined;
    secureUserData: SecureUserData | undefined;
    downloaderQueue: string | undefined;
    AWS_REGION: string | undefined;

    async loadSecrets(pp: PUBLIC_PRIVATE): Promise<System | HttpResponse> {
        this.downloaderQueue = process.env.DOWNLOADER_QUEUE;
        this.AWS_REGION = process.env.AWS_REGION;
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

    async incrementApiCounter(event: APIGatewayProxyEventV2WithRequestContext<any>) {
        await this.asyncWithConnection(async conn => conn.query("update counters set api_calls = api_calls + 1"));
        const mcp = event && event.queryStringParameters && event.queryStringParameters['mcp'];
        if (mcp) {
            await this.asyncWithConnection(async conn => conn.query("update counters set mcp = mcp + 1"));
        }
    }

    async loadSecureUserData(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<void> {
        let userData: SecureUserData | undefined = undefined;
        const cookies = getCookiesFromEvent(event);
        const secureCookie = cookies['extstatssec'];
        let authHeader: string | undefined = undefined;
        for (const h in (event?.headers || {})) {
            console.log(h);
            console.log(event.headers[h]);
            if (h.toLowerCase() === "authorization") {
                authHeader = event.headers[h];
                break;
            }
        }
        console.log(`authHeader ${authHeader}`);
        if (authHeader && authHeader.startsWith("Basic ")) {
            authHeader = authHeader.substring(6);
            const enc = Buffer.from(authHeader, 'base64').toString('ascii');
            if (enc.indexOf(':') > 0) {
                const pos = enc.indexOf(':');
                const user = enc.substring(0, pos);
                const p = enc.substring(pos+1);
                const auth = await checkPassword(this, user, p);
                if (!isHttpResponse(auth)) {
                    const sData: string = auth.configuration || "{}";
                    userData = { user, data: JSON.parse(sData) };
                }
            }
        }
        if (!userData && secureCookie) {
            const user = getUserFromSecureCookie(secureCookie);
            const sData: string = (await loadAuth(this, user))?.configuration || "{}";
            userData = { user, data: JSON.parse(sData) };
        }
        this.secureUserData = userData;
        this.secureUser = this.secureUserData?.user;
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
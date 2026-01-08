import * as mysql from "promise-mysql";
import {APIGatewayProxyEventV2WithRequestContext} from "aws-lambda/trigger/api-gateway-proxy.js";
import {getUserFromEvent} from "./library.mjs";

export async function findSystem(event: APIGatewayProxyEventV2WithRequestContext<any> | undefined = undefined): Promise<System | HttpResponse> {
    const sys = new System();
    if (event) sys.user = getUserFromEvent(event);
    return await sys.loadSecrets();
}

export class System {
    private mysqlHost: string | undefined;
    private mysqlUsername: string | undefined;
    private mysqlPassword: string | undefined;
    private mysqlDatabase: string | undefined;
    user: string | undefined;

    async loadSecrets(): Promise<System | HttpResponse> {
        this.mysqlHost = process.env.MYSQL_HOST;
        this.mysqlUsername = process.env.MYSQL_USERNAME;
        this.mysqlPassword = process.env.MYSQL_PASSWORD;
        this.mysqlDatabase = process.env.MYSQL_DATABASE;
        return this;
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

    async incrementApiCounter() {
        await this.asyncWithConnection(async conn => conn.query("update counters set api_calls = api_calls + 1"));
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
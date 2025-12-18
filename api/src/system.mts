import * as mysql from "promise-mysql";

export async function findSystem(): Promise<System | HttpResponse> {
    const sys = new System();
    return await sys.loadSecrets();
}

export class System {
    private mysqlHost: string | undefined;
    private mysqlUsername: string | undefined;
    private mysqlPassword: string | undefined;
    private mysqlDatabase: string | undefined;

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
}

export interface HttpResponse {
    statusCode: number;
    body?: string;
    headers?: Record<string, any>;
}

export function isHttpResponse(object: any): object is HttpResponse {
    return 'statusCode' in object;
}
import {GetParameterCommand, SSMClient} from "@aws-sdk/client-ssm";
import mysql from "promise-mysql";
import process from "process";

export async function loadSystem() {
    const s = new System();
    return await s.loadSecrets();
}

export class System {
    downloaderQueue: string;
    systemLogGroup: string;
    playsQueue: string;
    retryQueue: string;
    ok: boolean;

    constructor() {
        this.ok = false;
    }

    async loadSecrets(): Promise<System> {
        this.systemLogGroup = await this.getParameter("/extstats/systemLogGroup");
        this.downloaderQueue = await this.getParameter("/extstats/downloader/queue");
        this.playsQueue = await this.getParameter("/extstats/downloader/playsqueue");
        this.retryQueue = await this.getParameter("/extstats/downloader/retryqueue");
        this.ok = true;
        return this;
    }

    async getParameter(key: string): Promise<string> {
        const ssmClient = new SSMClient({
            apiVersion: '2014-11-06',
            region: process.env.AWS_REGION
        });
        const response = await ssmClient.send(
            new GetParameterCommand({
                Name: key
            })
        );
        return response.Parameter.Value;
    }

    async withConnectionAsync(func: (conn: mysql.Connection) => Promise<any>) {
        const connection = await this.getConnection();
        try {
            await func(connection);
            connection.destroy();
        } catch (e) {
            connection.destroy();
            throw e;
        }
    }

    async returnWithConnection<T>(func: (conn: mysql.Connection) => PromiseLike<T>): Promise<T> {
        let connection: mysql.Connection;
        let result: PromiseLike<T>;
        return await this.getConnection()
            .then(conn => {
                connection = conn;
                return conn;
            })
            .then(conn => result = func(conn))
            .then(() => connection.destroy())
            .catch(err => {
                connection.destroy();
                throw err;
            })
            .then(() => result);
    }

    // TODO - load the database secrets from AWS
    async getConnection(): Promise<mysql.Connection> {
        const params = {
            host: process.env.mysqlHost,
            user: process.env.mysqlUsername,
            password: process.env.mysqlPassword,
            database: process.env.mysqlDatabase
        };
        return mysql.createConnection(params);
    }
}



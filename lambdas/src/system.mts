import {GetSecretValueCommand, SecretsManagerClient} from "@aws-sdk/client-secrets-manager";
import {GetParameterCommand, GetParametersByPathCommand, SSMClient} from "@aws-sdk/client-ssm";
import * as mysql from 'promise-mysql';

const BGG_SECRETS = "extstats/bgg";

export async function findSystem(opts: string[]): Promise<System | HttpResponse> {
    const s = new System();
    if (opts.includes("bgg")) await s.loadBGGSecrets();
    if (opts.includes("logging")) await s.loadLoggingSecrets();
    if (opts.includes("db")) await s.loadDatabaseSecrets();
    return s;
}

export class System {
    public forumChecker: string | undefined;
    public minarticleid: number;
    public authcheckThread: string | undefined;
    public systemLogGroup: string | undefined;
    private mysqlHost: string | undefined;
    private mysqlUsername: string | undefined;
    private mysqlPassword: string | undefined;
    private mysqlDatabase: string | undefined;

    async loadDatabaseSecrets(): Promise<HttpResponse | void> {
        this.mysqlHost = process.env.MYSQL_HOST;
        this.mysqlUsername = process.env.MYSQL_USERNAME;
        this.mysqlPassword = process.env.MYSQL_PASSWORD;
        this.mysqlDatabase = process.env.MYSQL_DATABASE;
    }

    async loadLoggingSecrets(): Promise<HttpResponse | void> {
        console.log("loadLoggingSecrets");
        // this.systemLogGroup = await this.getParameter("/extstats/systemLogGroup");
        this.systemLogGroup = "extstats-system";
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
        console.log(`key = ${key}`);
        console.log(`Value = ${response.Parameter.Value}`);
        return response.Parameter.Value;
    }

    async loadBGGSecrets(): Promise<HttpResponse | void> {
        console.log("loadBGGSecrets");
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
            this.forumChecker = obj.forum_checker;
        } catch (error) {
            console.log(error);
            return {
                "statusCode": 500,
                "body": JSON.stringify({error: `Can't find secret ${BGG_SECRETS} - make sure it exists in AWS.`})
            }
        }
        console.log("loadBGGSecrets2");
        const ssmClient = new SSMClient({
            apiVersion: '2014-11-06',
            region: process.env.AWS_REGION
        });
        const path = "/extstats/authcheck";
        const response = await ssmClient.send(
            new GetParametersByPathCommand({
                Path: path,
                Recursive: true
            })
        );
        for (const p of response.Parameters) {
            console.log(p.Name);
            switch (p.Name) {
                case `${path}/minarticleid`:
                    this.minarticleid = parseInt(p.Value);
                    break;
                case `${path}/url`:
                    this.authcheckThread = p.Value;
                    break;
            }
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
    return object && 'statusCode' in object;
}
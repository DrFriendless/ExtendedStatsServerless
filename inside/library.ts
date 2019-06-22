import mysql = require('promise-mysql');
import { NormalisedPlays } from "./interfaces";
import { Lambda } from 'aws-sdk';

const INSIDE_PREFIX = "inside-dev-";

export async function withConnectionAsync(func: (conn: mysql.Connection) => Promise<any>) {
    const connection = await getConnection();
    try {
        await func(connection);
        connection.destroy();
    } catch (e) {
        connection.destroy();
        throw e;
    }
}

export function returnWithConnection<T>(func: (conn: mysql.Connection) => PromiseLike<T>): Promise<T> {
    let connection;
    let result;
    return getConnection()
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

export async function getConnection(): Promise<mysql.Connection> {
    const params = {
        host: process.env.mysqlHost,
        user: process.env.mysqlUsername,
        password: process.env.mysqlPassword,
        database: process.env.mysqlDatabase
    };
    return mysql.createConnection(params);
}

export function count(conn: mysql.Connection, sql: string, params: any[]): PromiseLike<number> {
    return conn.query(sql, params).then(result => result[0]["count(*)"]);
}

export function listMinus(ints: number[], takeaway: number[]): number[] {
    return ints.filter(x => takeaway.indexOf(x) < 0);
}

export function listIntersect(ints: number[], other: number[]): number[] {
    return ints.filter(x => other.indexOf(x) >= 0);
}

export function playDate(play: NormalisedPlays): number {
    return play.year * 10000 + play.month * 100 + play.date;
}

export function extractNormalisedPlayFromPlayRow(row: object, geek: number, month: number, year: number): NormalisedPlays {
    const playDate = row["playDate"].toString();
    let date = parseInt(playDate.split(" ")[2]);
    if (isNaN(date)) {
        date = 0;
    }
    return { month, year, geek, date, game: row["game"], quantity: row["quantity"] } as NormalisedPlays;
}

export function eqSet(as, bs): boolean {
    if (as.size !== bs.size) return false;
    for (const a of as) if (!bs.has(a)) return false;
    return true;
}

export function logError(message: string): Promise<void> {
    return invokeLambdaAsync("inside.logError", INSIDE_PREFIX + "logError", { source: "inside", message });
}

export function invokeLambdaAsync(context: string, func: string, payload: object): Promise<void> {
    const params = {
        ClientContext: context,
        FunctionName: func,
        InvocationType: "Event", // this is an async invocation
        LogType: "None",
        Payload: JSON.stringify(payload),
    };
    const lambda = new Lambda();
    return new Promise(function (fulfill, reject) {
        lambda.invoke(params, function (err, data) {
            if (err) {
                reject(err);
            } else {
                fulfill();
            }
        });
    });
}
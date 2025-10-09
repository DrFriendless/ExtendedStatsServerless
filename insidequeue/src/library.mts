import mysql = require('promise-mysql');
import {NormalisedPlays} from "./interfaces.mjs";
import {InvokeCommand, LambdaClient} from "@aws-sdk/client-lambda";

export type PlaysRow = { game: number, playDate: string, quantity: number, location: string };

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
    let connection: mysql.Connection;
    let result: PromiseLike<T>;
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
    console.log(params);
    return mysql.createConnection(params);
}

export async function count(conn: mysql.Connection, sql: string, params: any[]): Promise<number> {
    const result = await conn.query(sql, params);
    return result[0]["count(*)"];
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

export function extractNormalisedPlayFromPlayRow(row: PlaysRow, geek: number, month: number, year: number): NormalisedPlays {
    const playDate = row.playDate.toString();
    let date = parseInt(playDate.replace(/-/g, " ").split(" ")[2]);
    if (isNaN(date)) date = 0;
    return { month, year, geek, date, game: row.game, quantity: row.quantity, expansionPlay: false, location: row.location };
}

export function eqSet(as: Set<number>, bs: Set<number>): boolean {
    if (as.size !== bs.size) return false;
    for (const a of as) if (!bs.has(a)) return false;
    return true;
}

export async function invokeLambdaAsync(func: string, payload: object): Promise<void> {
    const lambda = new LambdaClient({ region: process.env.REGION });
    const command = new InvokeCommand({
        FunctionName: func,
        Payload: JSON.stringify(payload),
        InvocationType: "Event"
    });
    try {
        const resp = await lambda.send(command);
    } catch (error) {
        console.log(error);
    }
}
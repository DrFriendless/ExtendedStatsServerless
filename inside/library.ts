import mysql = require('promise-mysql');
import {Callback} from 'aws-lambda';
import {NormalisedPlays} from "./interfaces";

export async function withConnectionAsync(func: (conn: mysql.Connection) => Promise<any>) {
    let connection = await getConnection();
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

export function promiseToCallback<T extends object>(promise: Promise<T>, callback: Callback) {
    promise
        .then(v => callback(undefined, v))
        .catch(err => callback(err));
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


import mysql = require("promise-mysql");

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

export async function asyncReturnWithConnection<T>(func: (conn: mysql.Connection) => PromiseLike<T>): Promise<T> {
    const connection = await getConnection();
    try {
        return await func(connection);
    } finally {
        if (connection) connection.destroy();
    }
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

export async function returnWithConnectionAsync<T>(func: (conn: mysql.Connection) => PromiseLike<T>): Promise<T> {
    const connection = await getConnection();
    try {
        const result = await func(connection);
        connection.destroy();
        return result;
    } catch (e) {
        connection.destroy();
        throw e;
    }
}

export async function getGamesThatDontExist(conn: mysql.Connection): Promise<number[]> {
    const sql = "select bggid from not_games";
    return (await conn.query(sql)).map((row: { [key: string]: any }) => row.bggid);
}

export function listMinus(ints: number[], takeaway: number[]): number[] {
    return ints.filter(x => takeaway.indexOf(x) < 0);
}

export function listIntersect(ints: number[], other: number[]): number[] {
    return ints.filter(x => other.indexOf(x) >= 0);
}

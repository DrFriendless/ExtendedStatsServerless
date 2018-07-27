import mysql = require('promise-mysql');

export async function asyncReturnWithConnection<T>(func: (conn: mysql.Connection) => PromiseLike<T>): Promise<T> {
    const connection = await getConnection();
    try {
        return await func(connection);
    } finally {
        if (connection) connection.destroy();
    }
}

export function getConnection(): PromiseLike<mysql.Connection> {
    const params = {
        host: process.env.mysqlHost,
        user: process.env.mysqlUsername,
        password: process.env.mysqlPassword,
        database: process.env.mysqlDatabase
    };
    return mysql.createConnection(params);
}

export async function count(conn: mysql.Connection, sql: string, params: any[]): Promise<number> {
    return (await conn.query(sql, params))[0]["count(*)"];
}

export async function countTableRows(conn: mysql.Connection, tableName: string): Promise<number> {
    const sql = "select TABLE_ROWS t FROM INFORMATION_SCHEMA.TABLES where TABLE_NAME=?";
    return (await conn.query(sql, [tableName]))[0]["t"];
}


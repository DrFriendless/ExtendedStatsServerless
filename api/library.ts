import mysql = require('promise-mysql');

export function withConnection(func: (conn: mysql.Connection) => Promise<void>): Promise<void> {
    let connection;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => func(conn))
        .then(() => connection.destroy())
        .catch(err => {
            connection.destroy();
            throw err;
        });
}

export function returnWithConnection<T>(func: (conn: mysql.Connection) => Promise<T>): Promise<T> {
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

export function getConnection(): Promise<mysql.Connection> {
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


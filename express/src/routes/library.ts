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

import * as mysql from 'promise-mysql';

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

export async function getGeekId(conn: mysql.Connection, geek: string): Promise<number> {
    const getIdSql = "select id from geeks where geeks.username = ?";
    const results = await conn.query(getIdSql, [geek]);
    if (!results.length) throw new Error("Geek " + geek + " does not seem to be in Extended Stats");
    return results[0]['id'];
}

export async function getGeekIds(conn: mysql.Connection, geeks: string[]): Promise<{ [id: number]: string }> {
    if (!geeks) return undefined;
    if (geeks.length === 1) {
        const geek: string = geeks[0];
        const id: number = await getGeekId(conn, geek);
        const result = {};
        result[id] = geek;
        return result;
    }
    const getIdSql = "select id, username from geeks where geeks.username in (?)";
    const results = await conn.query(getIdSql, [geeks]);
    const result = {};
    for (const row of results) {
        result[parseInt(row.id)] = row.username;
    }
    return result;
}

// https://stackoverflow.com/questions/35572887/using-aws-gateway-api-can-i-access-the-cookies
/**
 * Receives an array of headers and extract the value from the cookie header
 * @param  {String}   errors List of errors
 * @return {Object}
 */
export function getCookiesFromHeader(headers) {
    if (headers === null || headers === undefined || headers.Cookie === undefined) {
        return {};
    }

    // Split a cookie string in an array (Originally found http://stackoverflow.com/a/3409200/1427439)
    const list = {};
    const rc = headers.Cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        const parts = cookie.split('=');
        const key = parts.shift().trim()
        const value = decodeURI(parts.join('='));
        if (key !== '') {
            list[key] = value;
        }
    });
    return list;
}
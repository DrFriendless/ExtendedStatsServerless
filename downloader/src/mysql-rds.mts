import mysql = require('promise-mysql');

export async function getGeekId(conn: mysql.Connection, geek: string): Promise<number | undefined> {
    const getIdSql = "select id from geeks where geeks.username = ?";
    const results = await conn.query(getIdSql, [geek]);
    if (!results || results.length === 0 || !results[0]) {
        console.log("No geek ID for " + geek);
        return undefined;
    }
    return results[0]["id"];
}
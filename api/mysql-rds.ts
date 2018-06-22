import mysql = require('promise-mysql');
import {SystemStats, TypeCount} from "./admin-interfaces"

export function gatherSystemStats(): Promise<SystemStats> {
    let userRows = 0;
    let gameRows = 0;
    let geekGamesRows = 0;
    let fileRows: [TypeCount] = [];
    let waitingFileRows: [TypeCount] = [];
    let unprocessedFileRows: [TypeCount] = [];
    let connection;
    const countUserRows = "select count(*) from geeks";
    const countGameRows = "select count(*) from games";
    const countGeekGameRows = "select count(*) from geekgames";
    const countFileRows = "select processMethod, count(url) from files group by processMethod";
    const countWaitingFileRows = "select processMethod, count(url) from files where lastUpdate is null or nextUpdate is null or nextUpdate < now() group by processMethod";
    const countUnprocessedFileRows = "select processMethod, count(url) from files where lastUpdate is null or nextUpdate is null group by processMethod";
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => Promise.all([
            count(conn, countUserRows, []).then(count => userRows = count),
            count(conn, countGameRows, []).then(count => gameRows = count),
            count(conn, countGeekGameRows, []).then(count => geekGamesRows = count),
            conn.query(countFileRows).then(rows => gatherTypeCounts(rows)).then(data => fileRows = data),
            conn.query(countWaitingFileRows).then(rows => gatherTypeCounts(rows)).then(data => waitingFileRows = data),
            conn.query(countUnprocessedFileRows).then(rows => gatherTypeCounts(rows)).then(data => unprocessedFileRows = data)
        ]))
        .then(() => connection.destroy())
        .then(() => {
            return {
                userRows: userRows,
                gameRows: gameRows,
                geekGamesRows: geekGamesRows,
                fileRows: fileRows,
                waitingFileRows: waitingFileRows,
                unprocessedFilesRows: unprocessedFileRows
            } as SystemStats;
        });
}

function gatherTypeCounts(stuff: any): [TypeCount] {
    console.log(stuff);
    return stuff.map(row => {
        return { type: row.processMethod, count: row["count(url)"] } as TypeCount;
    });
}

export function listUsers(): Promise<[string]> {
    console.log("listUsers");
    const sql = "select username from geeks";
    let connection;
    let result: [string];
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => conn.query(sql))
        .then(data => {
            result = data.map(row => row['username']);
        })
        .then(() => connection.destroy())
        .then(() => result);
}

function getConnection(): Promise<mysql.Connection> {
    const params = {
        host: process.env.mysqlHost,
        user: process.env.mysqlUsername,
        password: process.env.mysqlPassword,
        database: process.env.mysqlDatabase
    };
    return mysql.createConnection(params);
}

function count(conn: mysql.Connection, sql: string, params: [any]): Promise<number> {
    return conn.query(sql, params).then(result => result[0]["count(*)"]);
}


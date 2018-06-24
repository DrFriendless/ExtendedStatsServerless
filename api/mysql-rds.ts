import mysql = require('promise-mysql');
import {SystemStats, TypeCount} from "./admin-interfaces"
import {GeekGame, GeekGameQuery} from "./collection-interfaces";

export function listGeekGames(query: GeekGameQuery): Promise<[GeekGame]> {
    // TODO
    // return Promise.resolve([ { name: "Jeu de L'oie", average: 8.5, rating: 9, bggid: 15554 } ] as [GeekGame]);
    let connection;
    let result: [GeekGame];
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => doListGeekGames(conn, query))
        .then(data => {
            result = data;
            console.log("result");
            console.log(result);
        })
        .then(() => connection.destroy())
        .then(() => result);
}

function doListGeekGames(conn: mysql.Connection, query: GeekGameQuery): Promise<[GeekGame]> {
    const sql = "select games.bggid, games.name, games.average, geekgames.rating from games,geekgames where games.bggid = geekgames.game and geekgames.geek = ? and geekgames.owned = 1";
    return conn.query(sql, [query.geek])
        .then(data => {
            return data.map(row => {
                return {
                    bggid: row["bggid"],
                    name: row["name"],
                    rating: row["rating"],
                    average: row["average"]
                } as GeekGame;
            })
        });
}

export function gatherSystemStats(): Promise<SystemStats> {
    let userRows = 0;
    let gameRows = 0;
    let geekGamesRows = 0;
    let fileRows = [] as [TypeCount];
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
        ]))
        .then(() => Promise.all([
            connection.query(countWaitingFileRows).then(rows => patch(fileRows, "waiting", rows)),
            connection.query(countUnprocessedFileRows).then(rows => patch(fileRows, "unprocessed", rows))
        ]))
        .then(() => connection.destroy())
        .then(() => {
            return {
                userRows: userRows,
                gameRows: gameRows,
                geekGamesRows: geekGamesRows,
                fileRows: fileRows,
            };
        });
}

function patch(fileRows: [TypeCount], patchKey: string, countRows: [any]) {
    countRows.forEach(row => {
        const key = row["processMethod"];
        const count = row["count(url)"];
        fileRows.filter(row => row.type == key)[0][patchKey] = count;
    });
}

function gatherTypeCounts(stuff: any): [TypeCount] {
    return stuff.map(row => {
        return { type: row.processMethod, existing: row["count(url)"], unprocessed: 0, waiting: 0 } as TypeCount;
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

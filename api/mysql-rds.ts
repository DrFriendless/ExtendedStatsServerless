import mysql = require('promise-mysql');
import {SystemStats, TypeCount} from "./admin-interfaces"
import {GeekGame, GeekGameQuery} from "./collection-interfaces";
import {count, getConnection, returnWithConnection, withConnection} from "./library";
import {RankingTableRow} from "./ranking-interfaces";

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

export function rankGames(query: object): Promise<RankingTableRow[]> {
    return returnWithConnection(async conn => doRankGames(conn, query));
}

async function doRankGames(conn: mysql.Connection, query: object): RankingTableRow[] {
    const sql = "select game, game_name, total_ratings, bgg_ranking, bgg_rating, normalised_ranking, total_plays from ranking_table order by total_ratings desc limit 1000";
    const rows = await conn.query(sql);
    let ranking = 1;
    rows.forEach(row => {
        row.ranking = ranking;
        ranking++;
    });
    return rows;
}

function doListGeekGames(conn: mysql.Connection, query: GeekGameQuery): Promise<GeekGame[]> {
    const sql = "select * from games,geekgames where games.bggid = geekgames.game and geekgames.geek = ? and geekgames.owned = 1";
    return returnWithConnection(conn => conn.query(sql, [query.geek]).then(data => data.map(extractGeekGame)));
}

function extractGeekGame(row: object): GeekGame {
    console.log(row);
    return {
        bggid: row["bggid"],
        name: row["name"],
        rating: row["rating"],
        average: row["average"],
        owned: row['owned'] > 0,
        prevOwned: row['prevowned'] > 0,
        wantToBuy: row['wanttobuy'] > 0,
        wantToPlay: row['wanttoplay'] > 0,
        preordered: row['preordered'] > 0
    } as GeekGame;
}

export function gatherSystemStats(): Promise<SystemStats> {
    return returnWithConnection(doGatherSystemStats);
}

function doGatherSystemStats(conn: mysql.Connection): Promise<SystemStats> {
    const countUserRows = "select count(*) from geeks";
    const countGameRows = "select count(*) from games";
    const countGeekGameRows = "select count(*) from geekgames";
    const countNotGames = "select count(*) from not_games";
    const countCategories = "select count(*) from categories";
    const countMechanics = "select count(*) from mechanics";
    const countGameMechanics = "select count(*) from game_mechanics";
    const countGameCategories = "select count(*) from game_categories";
    const countFileRows = "select processMethod, count(url) from files group by processMethod";
    const countWaitingFileRows = "select processMethod, count(url) from files where lastUpdate is null or nextUpdate is null or nextUpdate < now() group by processMethod";
    const countUnprocessedFileRows = "select processMethod, count(url) from files where lastUpdate is null or nextUpdate is null group by processMethod";
    let userRows = 0;
    let gameRows = 0;
    let geekGamesRows = 0;
    let notGames = 0;
    let mechanics = 0;
    let categories = 0;
    let gameMechanics = 0;
    let gameCategories = 0;
    let fileRows = [] as [TypeCount];

    return Promise.all([
        count(conn, countUserRows, []).then(count => userRows = count),
        count(conn, countGameRows, []).then(count => gameRows = count),
        count(conn, countGeekGameRows, []).then(count => geekGamesRows = count),
        count(conn, countNotGames, []).then(count => notGames = count),
        count(conn, countCategories, []).then(count => categories = count),
        count(conn, countMechanics, []).then(count => mechanics = count),
        count(conn, countGameMechanics, []).then(count => gameMechanics = count),
        count(conn, countGameCategories, []).then(count => gameCategories = count),
        conn.query(countFileRows).then(rows => gatherTypeCounts(rows)).then(data => fileRows = data),
        conn.query(countWaitingFileRows).then(rows => patch(fileRows, "waiting", rows)),
        conn.query(countUnprocessedFileRows).then(rows => patch(fileRows, "unprocessed", rows))
    ])
        .then(() => {
            return {
                userRows: userRows,
                gameRows: gameRows,
                geekGamesRows: geekGamesRows,
                fileRows: fileRows,
                notGames: notGames,
                categories: categories,
                mechanics: mechanics,
                gameCategories: gameCategories,
                gameMechanics: gameMechanics
            } as SystemStats;
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

export function listUsers(): Promise<string[]> {
    console.log("listUsers");
    const sql = "select username from geeks";
    return returnWithConnection(conn => conn.query(sql).then(data => data.map(row => row['username'])));
}


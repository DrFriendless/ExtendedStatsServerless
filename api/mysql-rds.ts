import mysql = require('promise-mysql');
import {SystemStats, TypeCount} from "./admin-interfaces"
import {GeekGame, GeekGameQuery} from "./collection-interfaces";
import {count, getConnection, returnWithConnection} from "./library";
import {RankingTableRow} from "./ranking-interfaces";

export function listGeekGames(query: GeekGameQuery): Promise<GeekGame[]> {
    // TODO
    // return Promise.resolve([ { name: "Jeu de L'oie", average: 8.5, rating: 9, bggid: 15554 } ] as [GeekGame]);
    let connection;
    let result: GeekGame[];
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
    const sql = "select game, game_name, total_ratings, num_ratings, bgg_ranking, bgg_rating, normalised_ranking, total_plays from ranking_table order by total_ratings desc limit 1000";
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

async function doGatherSystemStats(conn: mysql.Connection): Promise<SystemStats> {
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
    const countGeekGamesOwnedByZero = "select count(*) from geekgames where geekid = 0";
    const countGGOwners = "select count(distinct(geekid)) c from geekgames";
    const countsPlaysRows = "select count(*) from plays";
    const countExpansionsRows = "select count(*) from expansions";
    const countNormalisedPlaysRows = "select count(*) from plays_normalised";
    const userRows = await count(conn, countUserRows, []);
    const gameRows = await count(conn, countGameRows, []);
    const geekGamesRows = await count(conn, countGeekGameRows, []);
    const notGames = await count(conn, countNotGames, []);
    const mechanics = await count(conn, countMechanics, []);
    const categories = await count(conn, countCategories, []);
    const gameMechanics = await count(conn, countGameMechanics, []);
    const gameCategories = await count(conn, countGameCategories, []);
    const fileRows = (await conn.query(countFileRows)).map(gatherTypeCount);
    const ggForZero = await count(conn, countGeekGamesOwnedByZero, []);
    const distinctGGOwners = (await conn.query(countGGOwners, []))[0]["c"];
    const playsRows = await count(conn, countsPlaysRows, []);
    const expansionRows = await count(conn, countExpansionsRows, []);
    const normalisedPlaysRows = await count(conn, countNormalisedPlaysRows, []);
    ((await conn.query(countWaitingFileRows)) as any[]).forEach(row => patch(fileRows, "waiting", row));
    ((await conn.query(countUnprocessedFileRows)) as any[]).forEach(row => patch(fileRows, "unprocessed", row));
    return {
        userRows: userRows,
        gameRows: gameRows,
        geekGamesRows: geekGamesRows,
        fileRows: fileRows,
        notGames: notGames,
        categories: categories,
        mechanics: mechanics,
        gameCategories: gameCategories,
        gameMechanics: gameMechanics,
        ggForZero: ggForZero,
        distinctGGOwners: distinctGGOwners,
        playsRows: playsRows,
        expansionRows: expansionRows,
        normalisedPlaysRows: normalisedPlaysRows
    } as SystemStats;
}

function patch(fileRows: TypeCount[], patchKey: string, row: any) {
    const key = row["processMethod"];
    const count = row["count(url)"];
    fileRows.filter(row => row.type == key)[0][patchKey] = count;
}

function gatherTypeCount(row: any): TypeCount {
    return { type: row.processMethod, existing: row["count(url)"], unprocessed: 0, waiting: 0 } as TypeCount;
}

export function listUsers(): Promise<string[]> {
    console.log("listUsers");
    const sql = "select username from geeks";
    return returnWithConnection(conn => conn.query(sql).then(data => data.map(row => row['username'])));
}


import mysql = require('promise-mysql');
import {SystemStats, TypeCount} from "./admin-interfaces"
import {GeekGame, GeekGameQuery, WarTableRow} from "./collection-interfaces";
import {asyncReturnWithConnection, count, countTableRows} from "./library";
import {RankingTableRow} from "./ranking-interfaces";

export async function listGeekGames(query: GeekGameQuery): Promise<GeekGame[]> {
    return asyncReturnWithConnection(conn => doListGeekGames(conn, query));
}

export async function rankGames(query: object): Promise<RankingTableRow[]> {
    return asyncReturnWithConnection(async conn => doRankGames(conn, query));
}

async function doRankGames(conn: mysql.Connection, query: object): Promise<RankingTableRow[]> {
    const sql = "select game, game_name, total_ratings, num_ratings, bgg_ranking, bgg_rating, normalised_ranking, total_plays from ranking_table order by total_ratings desc limit 1000";
    const rows = await conn.query(sql);
    let ranking = 1;
    rows.forEach(row => {
        row.ranking = ranking;
        ranking++;
    });
    return rows;
}

async function doListGeekGames(conn: mysql.Connection, query: GeekGameQuery): Promise<GeekGame[]> {
    const sql = "select * from games,geekgames where games.bggid = geekgames.game and geekgames.geek = ? and geekgames.owned = 1";
    return await conn.query(sql, [query.geek]).then(data => data.map(extractGeekGame));
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

export async function gatherSystemStats(): Promise<SystemStats> {
    return asyncReturnWithConnection(doGatherSystemStats);
}

async function doGatherSystemStats(conn: mysql.Connection): Promise<SystemStats> {
    const countFileRows = "select processMethod, count(url) from files group by processMethod";
    const countWaitingFileRows = "select processMethod, count(url) from files where lastUpdate is null or nextUpdate is null or nextUpdate < now() group by processMethod";
    const countUnprocessedFileRows = "select processMethod, count(url) from files where lastUpdate is null or nextUpdate is null group by processMethod";
    const countGeekGamesOwnedByZero = "select count(*) from geekgames where geekid = 0";
    const countGGOwners = "select count(distinct(geekid)) c from geekgames";
    const userRows = await countTableRows(conn, "geeks");
    const gameRows = await countTableRows(conn, "games");
    const geekGamesRows = await countTableRows(conn, "geekgames");
    const notGames = await countTableRows(conn, "not_games");
    const mechanics = await countTableRows(conn, "mechanics");
    const categories = await countTableRows(conn, "categories");
    const gameMechanics = await countTableRows(conn, "game_mechanics");
    const gameCategories = await countTableRows(conn, "game_categories");
    const fileRows = (await conn.query(countFileRows)).map(gatherTypeCount);
    const ggForZero = await count(conn, countGeekGamesOwnedByZero, []);
    const distinctGGOwners = (await conn.query(countGGOwners, []))[0]["c"];
    const playsRows = await countTableRows(conn, "plays");
    const expansionRows = await countTableRows(conn, "expansions");
    const normalisedPlaysRows = await countTableRows(conn, "plays_normalised");
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

export async function listWarTable(): Promise<WarTableRow[]> {
    const sql = "select * from war_table order by lower(geekName) asc";
    return asyncReturnWithConnection(conn => conn.query(sql));
}

export async function listUsers(): Promise<string[]> {
    const sql = "select username from geeks";
    return asyncReturnWithConnection(conn => conn.query(sql).then(data => data.map(row => row['username'])));
}


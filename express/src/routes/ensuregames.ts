import { Request, Response } from "express";
import { getGamesThatDontExist, listMinus, returnWithConnectionAsync, withConnectionAsync } from "./library";
import mysql = require("promise-mysql");

/**
 *
 * @param {} req
 * @param {} res
 */
export async function ensuregames(req: Request, res: Response) {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const gameIds = body
        .map((x: any) => typeof x === "string" ? parseInt(x) : x)
        .filter((x: any) => typeof x === "number" && x > 0 && x < 10000000);
    const gameIdsToAdd = await returnWithConnectionAsync(conn => removeExistingGames(conn, gameIds));
    const success: number[] = [];
    for (const id of gameIdsToAdd) {
        try {
            // one transaction per game so that if we time out or something at least some get done.
            await withConnectionAsync(conn => doRecordGame(conn, id));
            success.push(id);
            console.log("added game " + id);
        } catch (e) {
            // meh
        }
    }
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(success));
}

async function removeExistingGames(conn: mysql.Connection, ids: number[]): Promise<number[]> {
    if (ids.length === 0) return;
    const sqlSome = "select bggid from files where bggid in (?) and processMethod = 'processGame'";
    const sqlOne = "select bggid from files where bggid = ? and processMethod = 'processGame'";
    let params;
    let sql;
    if (ids.length == 1) {
        sql = sqlOne;
        params = ids;
    } else {
        sql = sqlSome;
        params = [ids];
    }
    const found = (await conn.query(sql, params)).map((row: { [key: string]: any }) => row.bggid);
    const notExist = await getGamesThatDontExist(conn);
    return Array.from(new Set(listMinus(listMinus(ids, found), notExist)));
}

async function doRecordGame(conn: mysql.Connection, bggid: number) {
    const GAME_URL = "https://boardgamegeek.com/xmlapi/boardgame/%d&stats=1";
    const url = GAME_URL.replace("%d", bggid.toString());
    const insertSql = "insert into files (url, processMethod, geek, lastupdate, tillNextUpdate, description, bggid) values (?, ?, ?, ?, ?, ?, ?)";
    const insertParams = [url, "processGame", undefined, undefined, "838:00:00", "Game #" + bggid, bggid];
    await conn.query(insertSql, insertParams).catch(err => {});
}

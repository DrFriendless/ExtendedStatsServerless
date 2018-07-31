import {GeekGame, GeekGameQuery} from "./collection-interfaces";
import mysql = require('promise-mysql');
import {Arg, Argument, Expression, Integer, Keyword, parse, StringValue} from "./parser";
import {getGeekId} from "./library";

export async function selectGames(conn: mysql.Connection, query: GeekGameQuery): Promise<GeekGame[]> {
    const expr = parse(query.query);
    return await evaluate(conn, expr, query);
}

async function evaluateExpression(conn: mysql.Connection, expr: Expression, query: GeekGameQuery): Promise<number[]> {
    switch (expr.func) {
        case "all": {
            const args = [] as number[][];
            for (let arg of expr.args) {
                const v = await evaluateExpression(conn, arg as Expression, query);
                args.push(v);
            }
            let result = undefined;
            for (let arg of args) {
                if (typeof result === 'undefined') {
                    result = arg;
                } else {
                    result = result.filter(gg => arg.indexOf(gg) >= 0);
                }
            }
            return result;
        }
        case "rated": {
            let geek = evaluateSimpleArg(conn, expr.args[0] as Arg, query);
            if (typeof geek === 'string') {
                geek = await getGeekId(conn, geek as string);
            }
            const sql = "select game from geekgames where geek = ? and rating > 0";
            return (await conn.query(sql, [geek])).map(row => row["game"]);
        }
        case "played": {
            let geek = evaluateSimpleArg(conn, expr.args[0] as Arg, query);
            if (typeof geek === 'string') {
                geek = await getGeekId(conn, geek as string);
            }
            const sql = "select distinct game from plays_normalised where geek = ?";
            return (await conn.query(sql, [geek])).map(row => row["game"]);
        }
        case "owned": {
            let geek = evaluateSimpleArg(conn, expr.args[0] as Arg, query);
            if (typeof geek === 'string') {
                geek = await getGeekId(conn, geek as string);
            }
            const sql = "select game from geekgames where geek = ? and owned > 0";
            return (await conn.query(sql, [geek])).map(row => row["game"]);
        }
        default: {
            throw new Error("Unknown function " + expr.func);
        }
    }
}

function evaluateSimpleArg(conn: mysql.Connection, arg: Arg, query: GeekGameQuery): string | number {
    switch (arg.kind) {
        case Argument.Integer: return (arg as Integer).value;
        case Argument.StringValue: return (arg as StringValue).value;
        case Argument.Keyword: {
            const kw = arg as Keyword;
            if (kw.keyword === 'ME') {
                return query.geek;
            }
            console.log("keyword " + kw.keyword + " unknown");
            return undefined;
        }
        default: {
            console.log("Can't evaluate " + arg);
            return undefined;
        }
    }
}

async function doListOwnedGames(conn: mysql.Connection, query: GeekGameQuery): Promise<GeekGame[]> {
    const sql = "select * from geekgames where geekgames.geek = ? and geekgames.owned = 1";
    return await conn.query(sql, [query.geek]).then(data => data.map(extractGeekGame));
}

async function evaluate(conn: mysql.Connection, expr: Expression, query: GeekGameQuery): Promise<GeekGame[]> {
    const ids = await evaluateExpression(conn, expr, query);
    return await retrieveGeekGames(conn, ids, query.geek);
}

async function retrieveGeekGames(conn: mysql.Connection, ids: number[], geek: string): Promise<GeekGame[]> {
    const sqlOne = "select * from geekgames where geek = ? and game = ?";
    const sqlMany = "select * from geekgames where geek = ? and game in (?)";
    if (ids.length === 0) return [];
    const geekId = await getGeekId(conn, geek);
    if (ids.length === 1) {
        return (await conn.query(sqlOne, [geekId, ids[0]])).map(extractGeekGame);
    } else {
        return (await conn.query(sqlMany, [geekId, ids])).map(extractGeekGame);
    }
}


function extractGeekGame(row: object): GeekGame {
    return {
        bggid: row["game"],
        rating: row["rating"],
        owned: row['owned'] > 0,
        prevOwned: row['prevowned'] > 0,
        wantToBuy: row['wanttobuy'] > 0,
        wantToPlay: row['wanttoplay'] > 0,
        preordered: row['preordered'] > 0
    } as GeekGame;
}


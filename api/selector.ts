import mysql = require('promise-mysql');
import { Arg, Argument, Expression, Integer, Keyword, parse, StringValue } from "./parser";
import { getGeekId } from "./library";
import { GeekGameQuery, GeekGameQueryResult, SelectorMetadataSet } from "extstats-core";

export async function selectGames(conn: mysql.Connection, query: GeekGameQuery, q: string): Promise<GeekGameQueryResult> {
    const expr = parse(q);
    return await evaluate(conn, expr, query);
}

async function evaluateExpression(conn: mysql.Connection, expr: Expression, vars: Record<string, string>, metadata: SelectorMetadataSet):
    Promise<number[]> {
    switch (expr.func) {
        case "all": {
            const args = [] as number[][];
            for (const arg of expr.args) {
                const v = await evaluateExpression(conn, arg as Expression, vars, metadata);
                args.push(v);
            }
            let result = undefined;
            for (const arg of args) {
                if (typeof result === 'undefined') {
                    result = arg;
                } else {
                    result = result.filter(gg => arg.indexOf(gg) >= 0);
                }
            }
            return result;
        }
        case "minus": {
            const args = [] as number[][];
            for (const arg of expr.args) {
                const v = await evaluateExpression(conn, arg as Expression, vars, metadata);
                args.push(v);
            }
            let result = undefined;
            for (const arg of args) {
                if (typeof result === 'undefined') {
                    result = arg;
                } else {
                    result = result.filter(gg => arg.indexOf(gg) < 0);
                }
            }
            return result;
        }
        case "any": {
            const args = [] as number[][];
            for (const arg of expr.args) {
                const v = await evaluateExpression(conn, arg as Expression, vars, metadata);
                args.push(v);
            }
            let result = undefined;
            for (const arg of args) {
                if (typeof result === 'undefined') {
                    result = arg;
                } else {
                    for (const id of arg) {
                        if (result.indexOf(id) < 0) result.push(id);
                    }
                }
            }
            return result;
        }
        case "rated": {
            let geek = evaluateSimpleArg(expr.args[0] as Arg, vars);
            if (typeof geek === 'string') {
                geek = await getGeekId(conn, geek as string);
            }
            const sql = "select game from geekgames where geekid = ? and rating > 0";
            const ids = (await conn.query(sql, [geek])).map(row => row["game"]);
            ids.forEach(id => metadata.add(id, "rater", geek.toString()));
            return ids;
        }
        case "played": {
            let geek = evaluateSimpleArg(expr.args[0] as Arg, vars);
            let strgeek;
            if (typeof geek === 'string') {
                strgeek = geek;
                geek = await getGeekId(conn, geek as string);
            }
            const sql = "select distinct game from plays_normalised where geek = ?";
            const ids = (await conn.query(sql, [geek])).map(row => row["game"]) as number[];
            if (strgeek) ids.forEach(id => metadata.add(id, "player", strgeek));
            return ids;
        }
        case "owned": {
            let geek = evaluateSimpleArg(expr.args[0] as Arg, vars);
            let strgeek;
            if (typeof geek === 'string') {
                strgeek = geek;
                geek = await getGeekId(conn, geek as string);
            }
            const sql = "select game from geekgames where geekid = ? and owned > 0";
            const ids = (await conn.query(sql, [geek])).map(row => row["game"]);
            if (strgeek) ids.forEach(id => metadata.add(id, "owner", strgeek));
            return ids;
        }
        case "expansions": {
            return (await conn.query("select distinct expansion from expansions")).map(row => row["expansion"]);
        }
        case "designer": {
            const designer = evaluateSimpleArg(expr.args[0] as Arg, vars);
            return await selectDesigner(conn, designer as number);
        }
        case "publisher": {
            const publisher = evaluateSimpleArg(expr.args[0] as Arg, vars);
            return await selectPublisher(conn, publisher as number);
        }
        case "books" : {
            return await selectCategory(conn, "Book");
        }
        case "category" : {
            const cat = evaluateSimpleArg(expr.args[0] as Arg, vars);
            return await selectCategory(conn, cat as string);
        }
        case "mechanic" : {
            const mec = evaluateSimpleArg(expr.args[0] as Arg, vars);
            return await selectMechanic(conn, mec as string);
        }
        case "colour": {
            const colour = evaluateSimpleArg(expr.args[0] as Arg, vars) as string;
            // TODO - try to interpret non-string things as colours
            const ids = await evaluateExpression(conn, expr.args[1] as Expression, vars, metadata);
            ids.forEach(id => metadata.add(id, "colour", colour));
            return ids;
        }
        case "elseColour": {
            const colour = evaluateSimpleArg(expr.args[0] as Arg, vars) as string;
            // TODO - try to interpret non-string things as colours
            const ids = await evaluateExpression(conn, expr.args[1] as Expression, vars, metadata);
            ids.forEach(id => metadata.addIfNotPresent(id, "colour", colour));
            return ids;
        }
        default: {
            throw new Error("Unknown function " + expr.func);
        }
    }
}

async function selectDesigner(conn: mysql.Connection, designer: number): Promise<number[]> {
    const sql = "select game from game_designers where designer = ?";
    return (await conn.query(sql, [designer])).map(row => row["game"]);
}

async function selectPublisher(conn: mysql.Connection, publisher: number): Promise<number[]> {
    const sql = "select game from game_publishers where publisher = ?";
    return (await conn.query(sql, [publisher])).map(row => row["game"]);
}

async function selectCategory(conn: mysql.Connection, cat: string): Promise<number[]> {
    const sql = "select games.bggid id from games,categories,game_categories where games.bggid = game_categories.game and categories.name = ? and categories.id = game_categories.category";
    return (await conn.query(sql, [cat])).map(row => row["id"]);
}

async function selectMechanic(conn: mysql.Connection, cat: string): Promise<number[]> {
    const sql = "select games.bggid id from games,mechanics,game_mechanics where games.bggid = game_mechanics.game and mechanics.name = ? and mechanics.id = game_mechanics.mechanic";
    return (await conn.query(sql, [cat])).map(row => row["id"]);
}

function evaluateSimpleArg(arg: Arg, vars: Record<string, string>): string | number {
    switch (arg.kind) {
        case Argument.Integer: return (arg as Integer).value;
        case Argument.StringValue: {
            const s = (arg as StringValue).value;
            return s.slice(1, -1);
        }
        case Argument.Keyword: {
            const kw = arg as Keyword;
            if (vars[kw.keyword]) return vars[kw.keyword];
            throw new Error("No value for keyword " + kw.keyword);
        }
        default: {
            throw new Error("Can't evaluate " + arg);
        }
    }
}

async function evaluate(conn: mysql.Connection, expr: Expression, query: GeekGameQuery): Promise<GeekGameSelectResult> {
    const vars: Record<string, string> = {};
    Object.assign(vars, query.vars);
    vars['ME'] = query.geek;
    return evaluateSimple(conn, expr, vars);
}

/**
 * Evaluate the expression to find out what games it represents, then retrieve them.
 * @param conn
 * @param expr
 * @param vars
 */
export async function evaluateSimple(conn: mysql.Connection, expr: Expression, vars: Record<string, string>): Promise<GeekGameSelectResult> {
    const metadata = new SelectorMetadataSet();
    const ids = await evaluateExpression(conn, expr, vars, metadata);
    metadata.restrictTo(ids);
    return { geekGames: await retrieveGeekGames(conn, ids, vars['ME']), metadata } as GeekGameSelectResult;
}

async function retrieveGeekGames(conn: mysql.Connection, ids: number[], geek: string): Promise<GeekGameRow[]> {
    const sqlOne = "select * from geekgames where geekid = ? and game = ?";
    const sqlMany = "select * from geekgames where geekid = ? and game in (?)";
    if (ids.length === 0) return [];
    const geekId = await getGeekId(conn, geek);
    if (ids.length === 1) {
        return (await conn.query(sqlOne, [geekId, ids[0]])).map(extractGeekGame);
    } else {
        return (await conn.query(sqlMany, [geekId, ids])).map(extractGeekGame);
    }
}

export interface GeekGameSelectResult {
    metadata: SelectorMetadataSet;
    geekGames: GeekGameRow[];
}

export type GeekGameRow = {
    bggid: number;
    rating: number;
    owned: boolean;
    wantToBuy: boolean;
    wantToPlay: boolean;
    preordered: boolean;
    prevOwned: boolean;
    geekid: number;
    wantInTrade: boolean;
    wish: number;
    forTrade: boolean;
}

function extractGeekGame(row: object): GeekGameRow {
    return {
        geekid: row["geekid"],
        bggid: row["game"],
        rating: row["rating"],
        owned: row['owned'] > 0,
        prevOwned: row['prevowned'] > 0,
        wantToBuy: row['wanttobuy'] > 0,
        wantToPlay: row['wanttoplay'] > 0,
        preordered: row['preordered'] > 0,
        wantInTrade: row['want'] > 0,
        wish: row['wish'],
        forTrade: row['trade'] > 0
    };
}


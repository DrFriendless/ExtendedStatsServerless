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
        case "minus": {
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
                    result = result.filter(gg => arg.indexOf(gg) < 0);
                }
            }
            return result;
        }
        case "any": {
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
                    for (let id of arg) {
                        if (result.indexOf(id) < 0) result.push(id);
                    }
                }
            }
            return result;
        }
        case "rated": {
            let geek = evaluateSimpleArg(expr.args[0] as Arg, query);
            if (typeof geek === 'string') {
                geek = await getGeekId(conn, geek as string);
            }
            const sql = "select game from geekgames where geekid = ? and rating > 0";
            return (await conn.query(sql, [geek])).map(row => row["game"]);
        }
        case "played": {
            let geek = evaluateSimpleArg(expr.args[0] as Arg, query);
            if (typeof geek === 'string') {
                geek = await getGeekId(conn, geek as string);
            }
            const sql = "select distinct game from plays_normalised where geek = ?";
            return (await conn.query(sql, [geek])).map(row => row["game"]);
        }
        case "owned": {
            let geek = evaluateSimpleArg(expr.args[0] as Arg, query);
            if (typeof geek === 'string') {
                geek = await getGeekId(conn, geek as string);
            }
            const sql = "select game from geekgames where geekid = ? and owned > 0";
            console.log("geek = " + geek);
            return (await conn.query(sql, [geek])).map(row => row["game"]);
        }
        case "expansions": {
            return (await conn.query("select distinct expansion from expansions")).map(row => row["expansion"]);
        }
        case "designer": {
            let designer = evaluateSimpleArg(expr.args[0] as Arg, query);
            return await selectDesigner(conn, designer as number);
        }
        case "publisher": {
            let publisher = evaluateSimpleArg(expr.args[0] as Arg, query);
            return await selectPublisher(conn, publisher as number);
        }
        case "books" : {
            return await selectCategory(conn, "Book");
        }
        case "category" : {
            let cat = evaluateSimpleArg(expr.args[0] as Arg, query);
            return await selectCategory(conn, cat as string);
        }
        case "mechanic" : {
            let mec = evaluateSimpleArg(expr.args[0] as Arg, query);
            return await selectMechanic(conn, mec as string);
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

function evaluateSimpleArg(arg: Arg, query: GeekGameQuery): string | number {
    switch (arg.kind) {
        case Argument.Integer: return (arg as Integer).value;
        case Argument.StringValue: {
            let s = (arg as StringValue).value;
            return s.slice(1, -1);
        }
        case Argument.Keyword: {
            const kw = arg as Keyword;
            if (kw.keyword === 'ME') {
                return query.geek;
            }
            if (query.vars && query.vars[kw.keyword]) {
                return query.vars[kw.keyword];
            }
            throw new Error("No value for keyword " + kw.keyword);
        }
        default: {
            throw new Error("Can't evaluate " + arg);
        }
    }
}

async function evaluate(conn: mysql.Connection, expr: Expression, query: GeekGameQuery): Promise<GeekGame[]> {
    const ids = await evaluateExpression(conn, expr, query);
    return await retrieveGeekGames(conn, ids, query.geek);
}

async function retrieveGeekGames(conn: mysql.Connection, ids: number[], geek: string): Promise<GeekGame[]> {
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


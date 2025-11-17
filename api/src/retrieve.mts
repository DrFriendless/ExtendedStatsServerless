import * as graphql from "graphql";
import { APIGatewayProxyEvent } from "aws-lambda";
import { GraphQLInputObjectType, GraphQLObjectType } from "graphql";
import * as mysql from "promise-mysql";
import {GameData, GeekGame, MonthlyPlayCount, MonthlyPlays} from "extstats-core";
import {doRetrieveGames, getMonthlyCounts, getMonthlyPlays} from "./mysql-rds.mjs";
import {getGeekId, getGeekIds} from "./library.mjs";
import { parse } from "./parser.mjs";
import {evaluateSimple, GeekGameSelectResult, retrieveGeekGames} from "./selector.mjs";
import {VarBindings} from "./varbindings.mjs";
import DataLoader from "dataloader";
import {
    GeekGameRow,
    LastYearPlaysQueryResult,
    NormalisedPlaysQueryResult,
    PlaysRetrieveResult, RawPlaysQueryResult, RetrievePlay,
    ShouldPlayAdditionalData
} from "./interfaces.mjs";
import {findSystem, HttpResponse, isHttpResponse, System} from "./system.mjs";

interface Loaders {
    system: System;
    games: DataLoader<number, GameData>;
}

function createLoaders(system: System): Loaders {
    return {
        system: system,
        games: new DataLoader((ids: number[]) => batchGetGames(system, ids)),
    }
}

// dataloader objects
const ListOfString = new graphql.GraphQLList(graphql.GraphQLString!);
const ListOfInt = new graphql.GraphQLList(graphql.GraphQLInt!);
const DesignerType = new graphql.GraphQLObjectType({
    name: "Designer",
    fields: {
        bggid: { type: graphql.GraphQLInt! },
        name: { type: graphql.GraphQLString! },
        url: { type: graphql.GraphQLString! },
        boring: { type: graphql.GraphQLBoolean! }
    }
});
function buildGameDataType(loaders: Loaders) {
    return new graphql.GraphQLObjectType({
        name: "GameData",
        fields: {
            bggid: {type: graphql.GraphQLInt!},
            bggRanking: {type: graphql.GraphQLInt!},
            yearPublished: {type: graphql.GraphQLInt!},
            minPlayers: {type: graphql.GraphQLInt!},
            maxPlayers: {type: graphql.GraphQLInt!},
            playTime: {type: graphql.GraphQLInt!},
            name: {type: graphql.GraphQLString!},
            subdomain: {type: graphql.GraphQLString!},
            bggRating: {type: graphql.GraphQLFloat!},
            weight: {type: graphql.GraphQLFloat!},
            isExpansion: {type: graphql.GraphQLBoolean!},
            designers: {
                type: new graphql.GraphQLList(DesignerType!),
                resolve:
                    async (parent: GameData) => await loaders.system.asyncReturnWithConnection(async conn => resolveDesignersForGame(conn, parent.bggid))
            }
        }
    });
}

function buildGeekGameType(loaders: Loaders) {
    return new GraphQLObjectType({
            name: "GeekGame",
            fields: {
                geek: {type: graphql.GraphQLString},
                bggid: {type: graphql.GraphQLInt!},
                rating: {type: graphql.GraphQLFloat!},
                owned: {type: graphql.GraphQLBoolean!},
                wantToBuy: {type: graphql.GraphQLBoolean!},
                wantToPlay: {type: graphql.GraphQLBoolean!},
                preordered: {type: graphql.GraphQLBoolean!},
                prevOwned: {type: graphql.GraphQLBoolean!},
                lastPlay: {type: graphql.GraphQLInt!},
                firstPlay: {type: graphql.GraphQLInt!},
                daysSincePlayed: {type: graphql.GraphQLInt!},
                shouldPlayScore: {type: graphql.GraphQLFloat!},
                plays: {type: graphql.GraphQLInt!},
                lyPlays: {type: graphql.GraphQLInt!},
                years: {type: graphql.GraphQLInt!},
                months: {type: graphql.GraphQLInt!},
                lyMonths: {type: graphql.GraphQLInt!},
                expansion: {type: graphql.GraphQLBoolean!},
                forTrade: {type: graphql.GraphQLBoolean!},
                wantInTrade: {type: graphql.GraphQLBoolean!},
                wish: {type: graphql.GraphQLInt!},
                game: {
                    type: buildGameDataType(loaders),
                    resolve: (parent: { bggid: number }) => loaders.games.load(parent.bggid)
                }
            }
        }
    );
}
const PlaysWithDateType = new graphql.GraphQLObjectType({
    name: "PlaysWithDate",
    fields: {
        geek: { type: graphql.GraphQLString! },
        year: { type: graphql.GraphQLInt! },
        month: { type: graphql.GraphQLInt! },
        day: { type: graphql.GraphQLInt! },
        ymd: { type: graphql.GraphQLInt! },
        game: { type: graphql.GraphQLInt! },
        expansions: { type: ListOfInt },
        quantity: { type: graphql.GraphQLInt! }
    }
});
const VarBindingInputType = new GraphQLInputObjectType({
    name: "VarBinding",
    fields: {
        name: { type: graphql.GraphQLString! },
        value: { type: graphql.GraphQLString! }
    }
});

function buildMultiGeekPlaysType(loaders: Loaders) {
    return new GraphQLObjectType({
        name: "MultiGeekPlays",
        fields: {
            geeks: {type: ListOfString},
            plays: {type: new graphql.GraphQLList(PlaysWithDateType!)},
            games: {type: new graphql.GraphQLList(buildGameDataType(loaders))},
            geekgames: {type: new graphql.GraphQLList(buildGeekGameType(loaders))}
        }
    });
}

const SelectorMetadataType = new GraphQLObjectType({
    name: "SelectorMetadata",
    fields: {
        game: { type: graphql.GraphQLInt! },
        colour: { type: graphql.GraphQLString },
        owner: { type: graphql.GraphQLString },
        player: { type: graphql.GraphQLString },
        rater: { type: graphql.GraphQLString }
    }
});

function buildGeekGamesType(loaders: Loaders) {
    return new GraphQLObjectType({
        name: "GeekGames",
        fields: {
            games: {type: new graphql.GraphQLList(buildGameDataType(loaders))},
            geekGames: {type: new graphql.GraphQLList(buildGeekGameType(loaders))},
            metadata: {type: new graphql.GraphQLList(SelectorMetadataType!)}
        }
    });
}

// total plays for a geek for a month
const MonthlyPlayCountType = new GraphQLObjectType({
    name: "MonthlyPlaysCount",
    fields: {
        year: { type: graphql.GraphQLInt! },
        month: { type: graphql.GraphQLInt! },
        count: { type: graphql.GraphQLInt! }
    }
});
// plays of a geek for a game for a month
function buildMonthlyPlaysType(loaders: Loaders) {
    return new GraphQLObjectType({
        name: "MonthlyPlays",
        fields: {
            year: {type: graphql.GraphQLInt!},
            month: {type: graphql.GraphQLInt!},
            expansion: {type: graphql.GraphQLBoolean!},
            quantity: {type: graphql.GraphQLInt!},
            bggid: {type: graphql.GraphQLInt!},
            game: {
                type: buildGameDataType(loaders),
                resolve: (parent: { bggid: number }) => loaders.games.load(parent.bggid)
            }
        }
    });
}

function buildMonthlyPlaysAndCountsType(loaders: Loaders) {
    return new GraphQLObjectType({
        name: "MonthlyPlaysAndCounts",
        fields: {
            plays: {type: new graphql.GraphQLList(buildMonthlyPlaysType(loaders)!)},
            counts: {type: new graphql.GraphQLList(MonthlyPlayCountType!)},
            geekGames: {type: new graphql.GraphQLList(buildGeekGameType(loaders))}
        }
    });
}

function buildSchema(loaders: Loaders) {
    return new graphql.GraphQLSchema({
        query: new graphql.GraphQLObjectType({
            name: "RetrieveQuery",
            fields: {
                plays: {
                    args: {
                        geeks: { type: ListOfString },
                        first: { type: graphql.GraphQLBoolean },
                        startYMD: { type: graphql.GraphQLInt },
                        endYMD: { type: graphql.GraphQLInt }
                    },
                    type: buildMultiGeekPlaysType(loaders),
                    resolve: async (parent: unknown, args) =>
                        await loaders.system.asyncReturnWithConnection(
                            async conn => playsQueryForRetrieve(conn, args.geeks, !!args.first, args.startYMD || 0, args.endYMD || 30000000)
                        )
                },
                geekgames: {
                    args: {
                        selector: { type: graphql.GraphQLString },
                        vars: { type: new graphql.GraphQLList(VarBindingInputType!) }
                    },
                    type: buildGeekGamesType(loaders),
                    resolve: async (parent: unknown, args) =>
                        await loaders.system.asyncReturnWithConnection(
                            async conn => geekGamesQueryForRetrieve(conn, args.selector, new VarBindings(args.vars)))
                },
                years: {
                    args: {
                        geek: { type: graphql.GraphQLString! }
                    },
                    type: ListOfInt,
                    resolve: async(parent: unknown, args) =>
                        await loaders.system.asyncReturnWithConnection(
                            async conn => geekYearsQueryForRetrieve(conn, args.geek))
                },
                monthly: {
                    args: {
                        selector: { type: graphql.GraphQLString },
                        vars: { type: new graphql.GraphQLList(VarBindingInputType!) }
                    },
                    type: buildMonthlyPlaysAndCountsType(loaders),
                    resolve: async (parent: unknown, args) =>
                        await loaders.system.asyncReturnWithConnection(
                            async conn => monthlyPlaysQueryForRetrieve(conn, args.selector, new VarBindings(args.vars)))
                }
            }
        })
    });
}

interface CoreMonthlyPlays {
    year: number;
    month: number;
    expansion: boolean;
    quantity: number;
    bggid: number;
}

type GeekGameSelectWithGames = GeekGameSelectResult & { games: GameData[] };
interface DesignerData {
    bggid: number;
    name: string;
    url: string;
    boring: boolean;
}
interface MonthlyPlaysAndCounts {
    plays: CoreMonthlyPlays[],
    counts: MonthlyPlayCount[],
    geekGames: GeekGame[]
}

async function monthlyPlaysQueryForRetrieve(conn: mysql.Connection, selector: string, varBindings: VarBindings): Promise<MonthlyPlaysAndCounts> {
    const evalResult: GeekGameSelectResult = await selectGames(conn, selector, varBindings);
    const geekGames = evalResult.geekGames.map(gg => gg.bggid);
    const geek = varBindings.lookup("ME");
    const plays: CoreMonthlyPlays[] = (await getMonthlyPlays(conn, geek))
        .filter(gp => geekGames.indexOf(gp.game) >= 0)
        .map((mp: MonthlyPlays) => {
            return { year: mp.year, month: mp.month, expansion: mp.expansion, quantity: mp.quantity, bggid: mp.game }
        });
    const counts = await getMonthlyCounts(conn, geek);
    return { counts, plays, geekGames: evalResult.geekGames };
}

async function resolveDesignersForGame(conn: mysql.Connection, gameId: number): Promise<DesignerData[]> {
    const sql = "select * from designers where bggid in (select designer from game_designers where game = ?)";
    const rows = await conn.query(sql, [gameId]);
    return rows.map(extractDesignerData);
}

function extractDesignerData(dbRow: any): DesignerData {
    return { bggid: dbRow['bggid'] as number, name: dbRow['name'], url: dbRow['url'], boring: dbRow['boring'] };
}

async function selectGames(conn: mysql.Connection, selector: string, vars: VarBindings): Promise<GeekGameSelectResult> {
    return evaluateSimple(conn, parse(selector), vars);
}

async function geekGamesQueryForRetrieve(conn: mysql.Connection, selector: string, vars: VarBindings): Promise<GeekGameSelectWithGames> {
    const evalResult = await selectGames(conn, selector, vars);
    await addLastPlayOfGamesForGeek(conn, evalResult.geekGames as (GeekGameRow & ShouldPlayAdditionalData)[]);
    const gids = evalResult.geekGames.map(gg => gg.bggid);
    const games = await doRetrieveGames(conn, gids);
    return { ...evalResult, games };
}

async function geekYearsQueryForRetrieve(conn: mysql.Connection, geek: string): Promise<number[]> {
    const geekId = await getGeekId(conn, geek);
    const getYearsSql = "select distinct year from plays_normalised where geek = ? order by 1";
    const data = await conn.query(getYearsSql, [geekId]) as { year: number }[];
    return data.map(row => row["year"]);
}

async function addLastPlayOfGamesForGeek(conn: mysql.Connection, geekGames: (GeekGameRow & ShouldPlayAdditionalData)[]) {
    if (geekGames.length === 0) return;
    const geekid = geekGames[0]['geekid'];
    const bggids = geekGames.map(gg => gg.bggid);
    const index: Record<number, GeekGame & ShouldPlayAdditionalData> = {};
    geekGames.forEach(gg => {
        index[gg.bggid] = gg;
        gg['shouldPlayScore'] = 0;
        gg['plays'] = 0;
        gg['years'] = 0;
        gg['months'] = 0;
        gg['expansion'] = false;
        gg['lyPlays'] = 0;
        gg['lyMonths'] = 0;
    });
    const sql = "select game, sum(quantity) q, max(expansion_play) x, max(year * 10000 + month * 100 + date) lastPlayed, min(year * 10000 + month * 100 + date) firstPlayed, count(distinct year) years, count(distinct year*100+month) months from plays_normalised where geek = ? and game in (?) group by game";
    const rows = await conn.query(sql, [geekid, bggids]) as NormalisedPlaysQueryResult[];
    rows.forEach(row => {
        index[row.game]['lastPlay'] = row['lastPlayed'];
        index[row.game]['firstPlay'] = row['firstPlayed'];
        index[row.game]['plays'] = row['q'];
        index[row.game]['years'] = row['years'];
        index[row.game]['months'] = row['months'];
        index[row.game]['expansion'] = row['x'] > 0;
    });

    const now = new Date();
    const today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const playsSql = "select game, sum(quantity) q, count(month) months from plays_normalised where geek = ? and ? - (year * 10000 + month * 100 + date) < 10000  and game in (?) group by game";
    const lyRows = await conn.query(playsSql, [geekid, today, bggids]) as LastYearPlaysQueryResult[];
    lyRows.forEach(lyRow => {
        index[lyRow['game']]['lyPlays'] = lyRow['q'];
        index[lyRow['game']]['lyMonths'] = lyRow['months'];
    });

    geekGames.forEach(gg => {
        if (gg['lastPlay']) {
            const lp = ymdToDate(gg['lastPlay']);
            const daysSince = Math.round((now.valueOf() - lp.valueOf()) / 86400000);
            if (gg.rating > 0) gg['shouldPlayScore'] = Math.pow(gg.rating, 4) * daysSince;
            gg['daysSincePlayed'] = daysSince;
        }
    });
}

function ymdToDate(ymd: number): Date {
    const y = Math.floor(ymd / 10000);
    const d = ymd % 100;
    const m = Math.floor(ymd / 100) % 100;
    return new Date(y, m - 1, d);
}

async function playsQueryForRetrieve(conn: mysql.Connection, geeks: string[], first: boolean, startInc: number, endExc: number): Promise<PlaysRetrieveResult> {
    const geekNameIds: { [id: number]: string } = await getGeekIds(conn, geeks);
    if (Object.values(geekNameIds).length === 0) {
        return { geeks: [], plays: [], games: [], geekgames: [] };
    }
    let where = "geek in (?)";
    const args: any[] = [ Object.keys(geekNameIds).map(s => parseInt(s)) ];
    if (Object.keys(geekNameIds).length === 1) {
        where = "geek = ?";
        args[0] = parseInt(Object.keys(geekNameIds)[0]);
    }
    if (first) where += " order by ymd asc";
    const playsSql = "select (year * 10000 + month * 100 + date) ymd, id, game, geek, quantity, year, month, date, expansion_play, baseplay from plays_normalised where " + where;
    const playsResult = await conn.query(playsSql, args) as RawPlaysQueryResult[];
    const expPlays: RawPlaysQueryResult[] = [];
    const basePlays: RetrievePlay[] = [];
    const playsById: Record<string, RetrievePlay> = {};
    const firstKeys: string[] = [];
    for (const row of playsResult) {
        if (first) {
            const firstKey = `${row.game}-${row.geek}`;
            if (firstKeys.indexOf(firstKey) >= 0) continue;
            firstKeys.push(firstKey);
        }
        if (row.ymd < startInc || row.ymd >= endExc) continue;
        if (row["expansion_play"]) {
            expPlays.push(row);
        } else {
            const username = geekNameIds[row.geek];
            if (!username) {
                console.log("No user found for " + row.geek);
                continue;
            }
            const pwd: RetrievePlay = { game: row.game, quantity: row.quantity, ymd: row.ymd, year: row.year, month: row.month,
                day: row.date, geek: username, expansions: [] };
            basePlays.push(pwd);
            playsById[row.id] = pwd;
        }
    }
    for (const ep of expPlays) {
        const pwd = playsById[ep["baseplay"]];
        if (!pwd) {
            console.log("No base play " + ep["baseplay"] + " found");
            continue;
        }
        pwd.expansions.push(ep["game"]);
    }
    const gameIds: number[] = [];
    for (const p of basePlays) {
        if (gameIds.indexOf(p.game) < 0) gameIds.push(p.game);
        for (const e of p.expansions) {
            if (gameIds.indexOf(e) < 0) gameIds.push(e);
        }
    }
    const games = await doRetrieveGames(conn, gameIds);
    const geekgames: GeekGameRow[] = [];
    for (const geek of Object.values<string>(geekNameIds)) {
        const ggs: GeekGameRow[] = await retrieveGeekGames(conn, gameIds, geek);
        geekgames.push(...ggs);
    }
    return { geeks: Object.values<string>(geekNameIds), plays: basePlays, games, geekgames };
}

export async function retrieve(event: APIGatewayProxyEvent): Promise<HttpResponse | object> {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    const loaders = createLoaders(system);
    // handle empty query for CORS
    const result = event.queryStringParameters.query ? await graphql.graphql({
        schema: buildSchema(loaders),
        source: event.queryStringParameters['query'] }
    ) : {};
    return {statusCode: 200, body: JSON.stringify(result)};
}

async function batchGetGames(system: System, gameIds: number[]): Promise<GameData[]> {
    return system.asyncReturnWithConnection(async conn => doRetrieveGames(conn, gameIds));
}
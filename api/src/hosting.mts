import {APIGatewayProxyEventV2WithRequestContext} from "aws-lambda/trigger/api-gateway-proxy.js";
import {findSystem, HttpResponse, isHttpResponse} from "./system.mjs";
import {HostingResult, HostingResultGame, HostingResultOpinion} from "export";
import * as graphql from "graphql/index.js";
import {buildSchema, createLoaders} from "./retrieve.mjs";
import * as mysql from "promise-mysql";
import {VarBindings} from "./varbindings.mjs";
import {evaluateSimple, GeekGameSelectResult} from "./selector.mjs";
import {parse} from "./parser.mjs";
import {getGeekId} from "./library.mjs";
import {retrieveGeekIdGames} from "./mysql-rds.mjs";
import {GeekGameRow, NormalisedPlaysQueryResult} from "./interfaces.mjs";

interface HostRawData {
    geekgames: {
        geekGames: {
            bggid: number;
            rating: number;
            tags: string[] | undefined;
            plays: number;
            game: {
                name: string;
                minPlayers: number;
                maxPlayers: number;
                weight: number;
            }
        }[];
    }
}

export async function hosting(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<HttpResponse | HostingResult> {
    const system = await findSystem("private", event);
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter(event);

    const host = event.queryStringParameters['geek'];
    const otherPlayers = (event.queryStringParameters['otherPlayers'] || "").split(",");
    const loaders = createLoaders(system);
    // give the selectors access to the authenticated user's private data
    const userData = system.secureUserData;
    const schema = buildSchema(loaders, userData);

    const geekFields = 'bggid rating tags plays';
    const gameFields = 'name minPlayers maxPlayers weight';
    const query = `{geekgames(selector: "minus(owned(ME),expansions(),books())", vars: [{name: "ME", value: "${host}"}]) { geekGames { ${geekFields} game { ${gameFields} } } } }`;

    console.log(query);
    const queryResult = await graphql.graphql({
            schema,
            source: query
        }
    );
    if (queryResult.errors) {
        return {
            statusCode: 400,
            body: JSON.stringify(queryResult.errors),
        }
    } else {
        const data = (queryResult.data as unknown as HostRawData).geekgames.geekGames;
        console.log(JSON.stringify(data));
        const bggIds = data.map(gg => gg.bggid);
        const otherPlayerIds: number[] = [];
        const otherPlayerData = await system.asyncReturnWithConnection(async conn => {
            const result: Record<string, Record<string, { rating: number, plays: number }>> = {};
            const geekIndex: Record<string, string> = {};
            for (const op of otherPlayers) {
                const opResult: Record<string, { rating: number, plays: number }> = {};
                const geekId = await getGeekId(conn, op);
                if (otherPlayerIds.indexOf(geekId) < 0) {
                    otherPlayerIds.push(geekId);
                    geekIndex[geekId.toString()] = op;
                }
                const rows: GeekGameRow[] = await retrieveGeekIdGames(conn, bggIds, op, geekId, undefined);
                for (const row of rows) {
                    opResult[row.bggid.toString()] = { rating: row.rating || -1, plays: 0 };
                }
                result[op] = opResult;
            }
            if (otherPlayerIds.length > 0) {
                const sql = "select game bggid, sum(quantity) q, geek from plays_normalised where geek in (?) and game in (?) group by game, geek";
                const playsData = await conn.query(sql, [otherPlayerIds, bggIds]) as { bggid: number, q: number, geek: number }[];
                for (const plays of playsData) {
                    result[geekIndex[plays.geek]][plays.bggid.toString()].plays = plays.q;
                }
            }
            return result;
        });
        console.log(JSON.stringify(otherPlayerData));
        const resultGames: HostingResultGame[] = [];
        const result: HostingResult = {
            games: resultGames
        }
        for (const gg of data) {
            const g = gg.game;
            const opinions: Record<string, HostingResultOpinion> = {};
            resultGames.push({ bggid: gg.bggid, name: g.name, minPlayers: g.minPlayers, maxPlayers: g.maxPlayers, tags: gg.tags || undefined, weight: g.weight, opinions});
            opinions[host] = { rating: gg.rating || -1, plays: gg.plays || 0 }
            for (const op in otherPlayerData) {
                opinions[op] = otherPlayerData[op][gg.bggid.toString()] || { rating: -1, plays: 0 }
            }
        }
        return {
            statusCode: 200,
            body: JSON.stringify(result),
        }
    }
}
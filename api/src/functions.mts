import {
    doGetNews,
    gatherGeekSummary,
    gatherGeekUpdates,
    gatherSystemStats,
    listUsers,
    listWarTable,
    rankGames,
    updateFAQCount,
    markUrlForUpdate,
    markGeekForUpdate,
    gatherSystemUpdates,
    getGeekGames,
    getAmbiguousGames,
    loadExpansionData,
    doRetrieveGameNames,
    patchGeekData,
    listCategoriesAndMechanics
} from "./mysql-rds.mjs";
import {APIGatewayProxyEvent} from "aws-lambda";
import {findSystem, HttpResponse, isHttpResponse} from "./system.mjs";
import {getCookiesFromEvent, getGeekId} from "./library.mjs";
import {APIGatewayProxyEventV2WithRequestContext} from "aws-lambda/trigger/api-gateway-proxy.js";
import {MostPlaysRow} from "./interfaces.mjs";
import {
    CatalistMetadata,
    DisambiguationData,
    FAQCount,
    GeekSummary,
    Hotness,
    MostPlayedEntry, NewsItem, RankingTableRow,
    SystemStats,
    ToProcessSummary,
    WarTableRow
} from "export";
import {ExpansionData, UserConfig} from "extstats-core";
import {loadAuth} from "./authdb.mjs";

export async function getCatalistMetadata(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<HttpResponse | CatalistMetadata> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();

    let tags: string[] = [];
    const cookies = getCookiesFromEvent(event);
    if (cookies['extstatsid']) {
        const user = cookies['extstatsid'];
        const sData: string = (await loadAuth(system, user))?.configuration || "{}";
        const uc = new UserConfig(JSON.parse(sData));
        const tagGroups = uc.get("tagalogue.taggroups", []);
        for (const tg of tagGroups) {
            for (const t of tg.tags) {
                if (tags.indexOf(t) < 0) tags.push(t);
            }
        }
        tags.sort();
    }
    const cm = await listCategoriesAndMechanics(system);
    return { ...cm, tags };
}

export async function getUpdates(event: APIGatewayProxyEvent): Promise<HttpResponse | { forGeek: ToProcessSummary[], forSystem: Record<string, number> }> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();

    return {
        forGeek: await gatherGeekUpdates(system, event.queryStringParameters.geek),
        forSystem: await gatherSystemUpdates(system)
    };
}

export async function markForUpdate(event: APIGatewayProxyEvent) {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await markUrlForUpdate(system, JSON.parse(event.body).url);
}

export async function updateOld(event: APIGatewayProxyEvent) {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await markGeekForUpdate(system, event.queryStringParameters.geek);
}

export async function getGeekSummary(event: APIGatewayProxyEvent): Promise<HttpResponse | GeekSummary> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await gatherGeekSummary(system, event.queryStringParameters.geek);
}

export async function incFAQCount(event: APIGatewayProxyEvent): Promise<HttpResponse | FAQCount[]> {
    console.log(event);
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await updateFAQCount(system, JSON.parse(event.body) as number[]);
}

export async function adminGatherSystemStats(event: APIGatewayProxyEvent): Promise<HttpResponse | SystemStats> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await gatherSystemStats(system);
}

// Lambda to retrieve the list of users
export async function getUserList(ignored: APIGatewayProxyEvent): Promise<HttpResponse | string[]> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await listUsers(system);
}

export async function getUserCheckList(event: APIGatewayProxyEvent): Promise<HttpResponse> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();

    const geek = event.queryStringParameters.geek;
    if (!geek) {
        return {
            statusCode: 400,
            body: JSON.stringify("You must specify a 'geek' parameter")
        }
    }

    const games = await getGeekGames(system, geek);
    const lines: string[] = [];
    lines.push('<html xmlns="http://www.w3.org/1999/xhtml" lang="en">');
    lines.push('<head><link rel="stylesheet" href="/css/checklist.css"></head>');
    lines.push("<body>");
    lines.push("<table>");
    lines.push("<thead><th class='found'>Found</th><th class='name'>Game</th><th class='rating'>Rating</th><th class='wtt'>WTT</th><th class='notes'>Notes</th>");
    lines.push("</thead>");
    lines.push("<tbody>");
    for (const game of games) {
        const r = game.rating <= 0 ? "" : game.rating.toString();
        const wtt = game.trade ? "X" : "";
        lines.push(`<tr><td>&nbsp;</td><td>${game.name}</td><td>${r}</td><td>${wtt}</td><td></td></tr>`);
    }
    lines.push("</tbody>");
    lines.push("</table>");
    lines.push("</body>");
    const html = lines.join("\n");
    return {
        statusCode: 200,
        body: html,
        headers: { "content-type": "text/html; charset=UTF-8" }
    }
}

// Lambda to retrieve the data for the war table.
export async function getWarTable(ignored: APIGatewayProxyEvent): Promise<HttpResponse | WarTableRow[]> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    const rows = await listWarTable(system);
    console.log(rows);
    return {
        statusCode: 200,
        body: JSON.stringify(rows)
    }
}

export async function getNews(event: APIGatewayProxyEvent): Promise<NewsItem[] | HttpResponse> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await system.asyncReturnWithConnection(async conn => await doGetNews(conn));
}

export async function getRankings(event: any): Promise<RankingTableRow[] | HttpResponse> {
    console.log(event);
    if (event) {
        const system = await findSystem("private");
        if (isHttpResponse(system)) return system;
        await system.incrementApiCounter();
        return await rankGames(system);
    } else {
        return [];
    }
}

export async function getDisambiguationData(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<DisambiguationData | HttpResponse> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();

    const cookies = getCookiesFromEvent(event);
    console.log(cookies);
    const geek = cookies['extstatsid'];
    if (!geek) {
        return {
            statusCode: 400,
            body: JSON.stringify("You must specify a 'geek' parameter")
        }
    }
    return await system.asyncReturnWithConnection(async conn => {
        const expansions: ExpansionData = await loadExpansionData(conn);
        const ambiguous = await getAmbiguousGames(conn, geek);
        const { games, plays } = ambiguous;
        // find all the distinct basegames
        const basegames: number[] = [];
        for (const g of games) {
            for (const e of expansions.getBasegames(g.bggid)) {
                if (!basegames.includes(e)) basegames.push(e);
            }
        }
        const gameNames = await doRetrieveGameNames(conn, basegames);
        const items = games.map(g => {
            const bgs = expansions.getBasegames(g.bggid);
            return { expansion: g, basegames: bgs.map(id => {
                    return { bggid: id, name: gameNames[id] || "?" };
                }) };
        });
        return { geek, plays, items };
    });
}

interface RawRecRow {
    bggid: number;
    xfactor: string;
    xfactor_bias: number;
    name: string;
    average: number;
    rank: number;
}

interface ProcessedRecRow {
    bggid: number;
    name: string;
    score: number;
    score0: number;
    score2: number;
    bggRating: number;
    bggRanking: number;
}

export async function getHotness(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<Hotness | HttpResponse> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();

    const geek = event.queryStringParameters.geek;
    if (!geek) {
        return {
            statusCode: 400,
            body: JSON.stringify("You must specify a 'geek' parameter")
        }
    }
    const ys = event.queryStringParameters.year || "";
    let year;
    try {
        year = parseInt(ys);
    } catch (e) {
        return {
            statusCode: 400,
            body: JSON.stringify("You must specify a 'year' parameter")
        }
    }
    const thisYear = (new Date()).getFullYear();
    if (year < 2000 || year > thisYear) {
        return {
            statusCode: 400,
            body: JSON.stringify("We don't have good data for that year")
        }
    }

    return await system.asyncReturnWithConnection(async conn => {
        const geekId = await getGeekId(conn, geek);
        const mpSql = "select games.bggid bggid, games.name name,count(distinct geek) geeks,sum(quantity) plays from plays_normalised,games where plays_normalised.game = games.bggid and expansion_play=0 and year=? group by year, game order by (geeks * 10 + plays) desc limit 50"
        const mpRows = await conn.query(mpSql, [year]) as MostPlaysRow[];
        const mpnSql = "select games.bggid bggid, games.name name,count(distinct geek) geeks,sum(quantity) plays from plays_normalised,games where plays_normalised.game = games.bggid and expansion_play=0 and year=? and yearPublished >= ? group by year, game order by (geeks * 10 + plays) desc limit 50"
        const mpnRows = await conn.query(mpnSql, [year, year-1]) as MostPlaysRow[];
        let bggIds = mpRows.map(r => r.bggid);
        bggIds = bggIds.concat(mpnRows.map(r => r.bggid).filter(id => bggIds.indexOf(id) < 0));
        const playSql = "select game bggid, sum(quantity) q from plays_normalised where expansion_play = 0 and geek = ? and game in (?) group by game";
        const yourPlays = await conn.query(playSql, [geekId, bggIds]) as { bggid: number, q: number }[];
        const yourPlaysByGame: Record<string, number> = {};
        for (const r of yourPlays) {
            yourPlaysByGame[r.bggid.toString()] = r.q;
        }
        const mostPlayed: MostPlayedEntry[] = await patchGeekData(conn, mpRows, geek, geekId);
        mostPlayed.forEach(mp => mp.yourPlays = yourPlaysByGame[mp.bggid.toString()] || 0);
        mostPlayed.sort((mp1, mp2) => mp2.plays - mp1.plays);
        const mostPlayedNew: MostPlayedEntry[] = await patchGeekData(conn, mpnRows, geek, geekId);
        mostPlayedNew.forEach(mp => mp.yourPlays = yourPlaysByGame[mp.bggid.toString()] || 0);
        mostPlayedNew.sort((mp1, mp2) => mp2.plays - mp1.plays);
        return { year, geek, mostPlayed, mostPlayedNew };
    });
}

export async function getRecommendations(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<ProcessedRecRow[] | HttpResponse> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();

    const geek = event.queryStringParameters.geek;
    if (!geek) {
        return {
            statusCode: 400,
            body: JSON.stringify("You must specify a 'geek' parameter")
        }
    }

    return await system.asyncReturnWithConnection(async conn => {
        const geekid = await getGeekId(conn, geek);
        const userXFactor = await conn.query("select xfactor from geeks where id = ?", [geekid]) as { xfactor: string }[];
        if (!userXFactor || !userXFactor[0].xfactor) return {
            statusCode: 400,
            body: JSON.stringify("This user has not yet had an X-Factor calculated.")
        };
        const ux = JSON.parse(userXFactor[0].xfactor) as number[];
        const data = await conn.query("select bggid, xfactor, xfactor_bias, name, games.average, games.rank from games where xfactor_bias is not null and bggid not in (select game from geekgames where geekid = ? and rating > 0)", [geekid]) as RawRecRow[];
        const scoredData: ProcessedRecRow[] = data.map(row => {
            const xf = JSON.parse(row.xfactor);
            const score0 = dotProduct(ux, xf);
            const score = dotProduct(ux, xf) + row.xfactor_bias;
            const score2 = dotProduct(ux, xf) + row.xfactor_bias / 5;
            return {
                bggid: row.bggid,
                name: row.name,
                score,
                score2,
                score0,
                bggRanking: row.rank,
                bggRating: row.average
            }
        });
        scoredData.sort((d1, d2) => d2.score - d1.score);
        return scoredData.slice(0, 500);
    });
}

function dotProduct(a: number[], b: number[]) {
    let total = 0;
    a.forEach((v, i) => {
        total += v * b[i];
    });
    return total;
}
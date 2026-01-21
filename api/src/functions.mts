import {
    doGetNews,
    doQuery,
    gatherGeekSummary,
    doPlaysQuery,
    gatherGeekUpdates,
    gatherSystemStats,
    listUsers,
    listWarTable,
    rankGames,
    updateFAQCount,
    markUrlForUpdate,
    markGeekForUpdate,
    gatherSystemUpdates, getGeekGames, getAmbiguousGames, loadExpansionData, doRetrieveGameNames
} from "./mysql-rds.mjs";
import {
    Collection, CollectionWithMonthlyPlays, CollectionWithPlays, DisambiguationData, ExpansionData,
    FAQCount,
    GeekGameQuery,
    GeekSummary, MultiGeekPlays,
    NewsItem,
    PlaysQuery,
    RankingTableRow,
    SystemStats, ToProcessElement,
    WarTableRow
} from "extstats-core";
import {APIGatewayProxyEvent} from "aws-lambda";
import {findSystem, HttpResponse, isHttpResponse} from "./system.mjs";

export async function getUpdates(event: APIGatewayProxyEvent): Promise<HttpResponse | { forGeek: ToProcessElement[], forSystem: Record<string, number> }> {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();

    return {
        forGeek: await gatherGeekUpdates(system, event.queryStringParameters.geek),
        forSystem: await gatherSystemUpdates(system)
    };
}

export async function markForUpdate(event: APIGatewayProxyEvent) {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await markUrlForUpdate(system, JSON.parse(event.body).url);
}

export async function updateOld(event: APIGatewayProxyEvent) {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await markGeekForUpdate(system, event.queryStringParameters.geek);
}

export async function getGeekSummary(event: APIGatewayProxyEvent): Promise<HttpResponse | GeekSummary> {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await gatherGeekSummary(system, event.queryStringParameters.geek);
}

export async function incFAQCount(event: APIGatewayProxyEvent): Promise<HttpResponse | FAQCount[]> {
    console.log(event);
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await updateFAQCount(system, JSON.parse(event.body) as number[]);
}

export async function adminGatherSystemStats(event: APIGatewayProxyEvent): Promise<HttpResponse | SystemStats> {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await gatherSystemStats(system);
}

// Lambda to retrieve the list of users
export async function getUserList(ignored: APIGatewayProxyEvent): Promise<HttpResponse | string[]> {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await listUsers(system);
}

export async function getUserCheckList(event: APIGatewayProxyEvent): Promise<HttpResponse> {
    const system = await findSystem();
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
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    const rows = await listWarTable(system);
    console.log(rows);
    return {
        statusCode: 200,
        body: JSON.stringify(rows)
    }
}

export async function query(event: APIGatewayProxyEvent): Promise<Collection | CollectionWithPlays | CollectionWithMonthlyPlays | HttpResponse> {
    if (event && event.body) {
        const query = JSON.parse(event.body) as GeekGameQuery;
        const system = await findSystem();
        if (isHttpResponse(system)) return system;
        await system.incrementApiCounter();
        return await system.asyncReturnWithConnection(async conn => await doQuery(conn, query));
    } else {
        return {
            statusCode: 400,
            body: "No query found"
        };
    }
}

export async function plays(event: APIGatewayProxyEvent): Promise<MultiGeekPlays | HttpResponse> {
    if (event && event.body) {
        const query = JSON.parse(event.body) as PlaysQuery;
        const system = await findSystem();
        if (isHttpResponse(system)) return system;
        await system.incrementApiCounter();
        return await system.asyncReturnWithConnection(async conn => await doPlaysQuery(conn, query));
    } else {
        return undefined;
    }
}

export async function getNews(event: APIGatewayProxyEvent): Promise<NewsItem[] | HttpResponse> {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();
    return await system.asyncReturnWithConnection(async conn => await doGetNews(conn));
}

export async function getRankings(event: any): Promise<RankingTableRow[] | HttpResponse> {
    console.log(event);
    if (event) {
        const query = {}; // TODO
        const system = await findSystem();
        if (isHttpResponse(system)) return system;
        await system.incrementApiCounter();
        return await rankGames(system, query);
    } else {
        return [];
    }
}

export async function getDisambiguationData(event: APIGatewayProxyEvent): Promise<DisambiguationData | HttpResponse> {
    const system = await findSystem();
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
import {
    doGetNews, doQuery, gatherGeekSummary, doPlaysQuery, gatherGeekUpdates,
    gatherSystemStats, listUsers, listWarTable, rankGames, updateFAQCount, markUrlForUpdate, markGeekForUpdate
} from "./mysql-rds.mjs";
import {GeekGameQuery, NewsItem, PlaysQuery} from "extstats-core";
import {APIGatewayProxyEvent} from "aws-lambda";
import {findSystem, HttpResponse, isHttpResponse} from "./system.mjs";

export async function getUpdates(event: APIGatewayProxyEvent) {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    return await gatherGeekUpdates(system, event.queryStringParameters.geek);
}

export async function markForUpdate(event: APIGatewayProxyEvent) {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    return await markUrlForUpdate(system, JSON.parse(event.body).url);
}

export async function updateOld(event: APIGatewayProxyEvent) {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    return await markGeekForUpdate(system, event.queryStringParameters.geek);
}

export async function getGeekSummary(event: APIGatewayProxyEvent) {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    return await gatherGeekSummary(system, event.queryStringParameters.geek);
}

export async function incFAQCount(event: APIGatewayProxyEvent) {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    return await updateFAQCount(system, JSON.parse(event.body) as number[]);
}

export async function adminGatherSystemStats(event: APIGatewayProxyEvent) {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    return await gatherSystemStats(system);
}

// Lambda to retrieve the list of users
export async function getUserList(ignored: APIGatewayProxyEvent) {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    return await listUsers(system);
}

// Lambda to retrieve the data for the war table.
export async function getWarTable(ignored: APIGatewayProxyEvent) {
    const system = await findSystem();
    console.log(system);
    if (isHttpResponse(system)) return system;
    const rows = await listWarTable(system);
    console.log(rows);
    return {
        statusCode: 200,
        body: JSON.stringify(rows)
    }
}

export async function query(event: APIGatewayProxyEvent) {
    if (event && event.body) {
        const query = JSON.parse(event.body) as GeekGameQuery;
        const system = await findSystem();
        if (isHttpResponse(system)) return system;
        return await system.asyncReturnWithConnection(async conn => await doQuery(conn, query));
    } else {
        return {};
    }
}

export async function plays(event: APIGatewayProxyEvent) {
    if (event && event.body) {
        const query = JSON.parse(event.body) as PlaysQuery;
        const system = await findSystem();
        if (isHttpResponse(system)) return system;
        return await system.asyncReturnWithConnection(async conn => await doPlaysQuery(conn, query));
    } else {
        return {};
    }
}

export async function getNews(event: APIGatewayProxyEvent): Promise<NewsItem[] | HttpResponse> {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    return await system.asyncReturnWithConnection(async conn => await doGetNews(conn));
}

export async function getRankings(event: any) {
    if (event && event.body) {
        const query = {}; // TODO
        const system = await findSystem();
        if (isHttpResponse(system)) return system;
        return await rankGames(system, query);
    } else {
        return {};
    }
}

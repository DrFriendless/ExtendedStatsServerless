import {Callback, Context} from "aws-lambda";
import {
    doGetNews, doQuery, gatherGeekSummary, doPlaysQuery, gatherGeekUpdates,
    gatherSystemStats, listUsers, listWarTable, rankGames, updateFAQCount, markUrlForUpdate, markGeekForUpdate
} from "./mysql-rds";
import { asyncReturnWithConnection } from "./library";
import { GeekGameQuery, PlaysQuery } from "extstats-core";

export async function getUpdates(event, context: Context, callback: Callback) {
    try {
        callback(undefined, await gatherGeekUpdates(event["query"]["geek"]));
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

export async function markForUpdate(event, context: Context, callback: Callback) {
    try {
        callback(undefined, await markUrlForUpdate(event.body.url));
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

export async function updateOld(event, context: Context, callback: Callback) {
    try {
        callback(undefined, await markGeekForUpdate(event["query"]["geek"]));
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

export async function getGeekSummary(event, context: Context, callback: Callback) {
    try {
        callback(undefined, await gatherGeekSummary(event["query"]["geek"]));
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

export async function incFAQCount(event, context: Context, callback: Callback) {
    try {
        callback(undefined, await updateFAQCount(event.body as number[]));
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

export async function adminGatherSystemStats(event, context: Context, callback: Callback) {
    try {
        callback(undefined, await gatherSystemStats());
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

// Lambda to retrieve the list of users
export async function getUserList(event, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        callback(undefined, await listUsers());
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

// Lambda to retrieve the data for the war table.
export async function getWarTable(event, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        callback(undefined, await listWarTable());
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

export async function query(event, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    if (event && event.body) {
        const query = event.body as GeekGameQuery;
        try {
            const result = await asyncReturnWithConnection(async conn => await doQuery(conn, query));
            callback(undefined, result);
        } catch (err) {
            console.log(err);
            callback(err);
        }
    } else {
        callback();
    }
}

export async function plays(event, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    if (event && event.body) {
        const query = event.body as PlaysQuery;
        try {
            const result = await asyncReturnWithConnection(async conn => await doPlaysQuery(conn, query));
            callback(undefined, result);
        } catch (err) {
            console.log(err);
            callback(err);
        }
    } else {
        callback();
    }
}

export async function getNews(event, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        const result = await asyncReturnWithConnection(async conn => await doGetNews(conn));
        callback(undefined, result);
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

export async function getRankings(event, context: Context, callback: Callback) {
    context.callbackWaitsForEmptyEventLoop = false;
    if (event && event.body) {
        const query = {}; // TODO
        try {
            callback(undefined, await rankGames(query));
        } catch (err) {
            console.log(err);
            callback(err);
        }
    } else {
        callback();
    }
}

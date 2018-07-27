import {Callback} from 'aws-lambda';
import {
    doListCollection,
    doListCollectionWithPlays,
    gatherSystemStats,
    listUsers,
    listWarTable,
    rankGames
} from "./mysql-rds";
import {CollectionWithPlays, GeekGame, GeekGameQuery} from "./collection-interfaces";
import {asyncReturnWithConnection} from "./library";

export async function adminGatherSystemStats(event, context, callback: Callback) {
    try {
        callback(null, await gatherSystemStats());
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

// Lambda to retrieve the list of users
export async function getUserList(event, context, callback: Callback) {
    console.log("getUserList");
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        callback(null, await listUsers());
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

// Lambda to retrieve the data for the war table.
export async function getWarTable(event, context, callback: Callback) {
    console.log("getWarTable");
    context.callbackWaitsForEmptyEventLoop = false;
    try {
        callback(null, await listWarTable());
    } catch (err) {
        console.log(err);
        callback(err);
    }
}

// Lambda to retrieve geek games
export async function getGeekGames(event, context, callback: Callback) {
    console.log("getGeekGames");
    console.log(event);
    context.callbackWaitsForEmptyEventLoop = false;
    if (event && event.body) {
        const query = event.body as GeekGameQuery;
        try {
            callback(null, await doGetGeekGames(query));
        } catch (err) {
            console.log(err);
            callback(err);
        }
    } else {
        callback(null);
    }
}

async function doGetGeekGames(query: GeekGameQuery): Promise<GeekGame[]> {
    return await asyncReturnWithConnection(async conn => await doListCollection(conn, query));
}

export async function getCollectionWithPlays(event, context, callback: Callback) {
    console.log("getGeekGames");
    console.log(event);
    if (event && event.body) {
        const query = event.body as GeekGameQuery;
        try {
            callback(null, await doGetCollectionWithPlays(query));
        } catch (err) {
            console.log(err);
            callback(err);
        }
    } else {
        callback(null);
    }
}

async function doGetCollectionWithPlays(query: GeekGameQuery): Promise<CollectionWithPlays> {
    return await asyncReturnWithConnection(async conn => await doListCollectionWithPlays(conn, query));
}

// Lambda to retrieve game rankings
export async function getRankings(event, context, callback: Callback) {
    console.log("getRankings");
    console.log(event);
    context.callbackWaitsForEmptyEventLoop = false;
    if (event && event.body) {
        const query = {}; // TODO
        try {
            callback(null, await rankGames(query));
        } catch (err) {
            console.log(err);
            callback(err);
        }
    } else {
        callback(null);
    }
}

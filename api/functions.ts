import {Callback} from 'aws-lambda';
import {gatherSystemStats, listGeekGames, listUsers, listWarTable, rankGames} from "./mysql-rds";
import {GeekGameQuery} from "./collection-interfaces";

export async function adminGatherSystemStats(event, context, callback: Callback) {
    try {
        callback(null, await gatherSystemStats());
    } catch (err) {
        console.log(err);
        callback(err, null);
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
        callback(err, null);
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
        callback(err, null);
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
            callback(null, await listGeekGames(query));
        } catch (err) {
            console.log(err);
            callback(err, null);
        }
    } else {
        callback(null, null);
    }
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
            callback(err, null);
        }
    } else {
        callback(null, null);
    }
}

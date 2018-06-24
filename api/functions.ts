import {Callback} from 'aws-lambda';
import {gatherSystemStats, listGeekGames, listUsers} from "./mysql-rds";
import {GeekGameQuery} from "./collection-interfaces";

export function adminGatherSystemStats(event, context, callback: Callback) {
    const promise = gatherSystemStats();
    promiseToCallback(promise, callback);
}

// Lambda to retrieve the list of users
export function getUserList(event, context, callback: Callback) {
    console.log("getUserList");
    context.callbackWaitsForEmptyEventLoop = false;
    promiseToCallback(listUsers(), callback);
}

// Lambda to retrieve the list of users
export function getGeekGames(event, context, callback: Callback) {
    console.log("getGeekGames");
    console.log(event);
    context.callbackWaitsForEmptyEventLoop = false;
    if (event && event.body) {
        const query = event.body as GeekGameQuery;
        promiseToCallback(listGeekGames(query), callback);
    } else {
        callback(null, null);
    }
}

function promiseToCallback<T>(promise: Promise<T>, callback: Callback) {
    promise
        .then(v => callback(undefined, v))
        .catch(err => callback(err));
}

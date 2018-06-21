import {Callback} from 'aws-lambda';
import {gatherSystemStats, listUsers} from "./mysql-rds";

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

function promiseToCallback<T>(promise: Promise<T>, callback: Callback) {
    promise
        .then(v => callback(undefined, v))
        .catch(err => callback(err));
}

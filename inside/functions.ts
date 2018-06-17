import {Callback} from 'aws-lambda';
import {
    ensureUsers,
    listToProcess,
    listUsers,
    markUrlProcessed,
    updateLastScheduledForUrls,
    updateUserValues
} from "./mysql-rds";
import {ProcessUserResult} from "./interfaces";

export function processUserResult(event, context, callback: Callback) {
    console.log(event);
    const data = event as ProcessUserResult;
    updateUserValues(data.geek, data.bggid, data.country)
        .then(() => markUrlProcessed(data.url))
        .then(v => callback(undefined, v))
        .catch(err => callback(err));
}

// Lambda to receive the list of users from processUserList and make sure they are all in the database
export function updateUserList(event, context, callback: Callback) {
    const body = event;
    const usernames = body.split(/\r?\n/);
    console.log("checking for " + usernames.length + " users");
    ensureUsers(usernames)
        .then(v => callback(undefined, v))
        .catch(err => callback(err));
}

// Lambda to retrieve the list of users
export function getUserList(event, context, callback: Callback) {
    console.log("getUserList");
    context.callbackWaitsForEmptyEventLoop = false;
    listUsers()
        .then(result => callback(undefined, {statusCode: 200, body: result}))
        .catch(err => callback(err));
}

// Lambda to retrieve some number of files that need processing
export function getToProcessList(event, context, callback: Callback) {
    // TODO - this needs to be true only when we are going to process these files.
    const updateLastScheduled = true;
    context.callbackWaitsForEmptyEventLoop = false;
    const countParam = (event.query && event.query.count) || event.count;
    let count = parseInt(countParam);
    if (!count || count < 1 || count > 1000) count = 10;
    listToProcess(count)
        .then(elements => {
            const urls = elements.map(row => row.url);
            if (!updateLastScheduled) {
                return Promise.resolve(elements);
            } else {
                return updateLastScheduledForUrls(urls).thenReturn(elements);
            }
        })
        .then(result => callback(undefined, {statusCode: 200, body: result}))
        .catch(err => callback(err));
}

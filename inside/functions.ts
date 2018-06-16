import {Callback, Handler} from 'aws-lambda';
import {ensureUsers, listToProcess, listUsers, updateLastScheduledForUrls} from "./mysql-rds";
import {ToProcessElement} from "interfaces";

// Lambda to get the list of users from an SQS queue and write it to Mongo DB.
export const updateUserList: Handler = (event, context, callback: Callback) => {
    console.log("updateUserList");
    const body = event.Records[0].Sns.Message;
    const usernames = body.split(/\r?\n/);
    console.log("checking for " + usernames.length + " users");
    ensureUsers(usernames);
};

export const getUserList: Handler = (event, context, callback: Callback) => {
    console.log("getUserList");
    context.callbackWaitsForEmptyEventLoop = false;
    listUsers((err, result) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, { statusCode: 200, body: result });
        }
    });
};

export const getToProcessList: Handler = (event, context, callback: Callback) => {
    console.log("getToProcessList");
    console.log(event);
    // TODO - this needs to be true only when we are going to process these files.
    const updateLastScheduled = true;
    context.callbackWaitsForEmptyEventLoop = false;
    const countParam = (event.query && event.query.count) || event.count;
    let count = parseInt(countParam);
    if (!count || count < 1 || count > 1000) count = 10;
    listToProcess(count, (err, result) => {
        if (err) {
            callback(err, null);
        } else {
            if (updateLastScheduled) {
                const rows = result as [ToProcessElement];
                const urls = rows.map(row => row.url);
                updateLastScheduledForUrls(urls, (err, result2) => {
                    if (err) {
                        console.log(err);
                        callback(err, null);
                    } else {
                        callback(null, {statusCode: 200, body: result});
                    }
                });
            } else {
                callback(null, {statusCode: 200, body: result});
            }
        }
    });
};

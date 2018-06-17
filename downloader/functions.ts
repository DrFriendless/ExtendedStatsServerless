import {Callback} from "aws-lambda";
import {ToProcessList, ProcessUserInvocation, ProcessUserResult} from "./interfaces"
import {between, invokelambdaAsync, makeAPIGetRequest} from "./library";

const request = require('request-promise-native');
// the max files to start processing for at once
const PROCESS_COUNT = 1;
const INSIDE_PREFIX = "inside-dev-";
const OUTSIDE_PREFIX = "downloader-dev-";

// method names from the database - this is the type of thing we have to do.
const METHOD_PROCESS_USER = "processUser";

// lambda names we expect to see
const FUNCTION_PROCESS_USER = "processUser";
const FUNCTION_UPDATE_USER_LIST = "updateUserList";

const FUNCTION_PROCESS_USER_RESULT = "processUserResult";

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export function processUserList(event, context, callback: Callback) {
    const usersFile = process.env["USERS_FILE"];
    request(usersFile)
        .then(data => invokelambdaAsync("processUserList", INSIDE_PREFIX + FUNCTION_UPDATE_USER_LIST, data))
        .then(data => console.log('Sent ' + data.split(/\r?\n/).length + ' users to ' + FUNCTION_UPDATE_USER_LIST))
        .then(v => callback(undefined, v))
        .catch(err => {
            console.log(err);
            callback(err);
        });
}

// Lambda to get files to be processed and invoke the lambdas to do that
export function fireFileProcessing(event, context, callback: Callback) {
    console.log("fireFileProcessing");
    const req = makeAPIGetRequest("/v1/toProcess?count=" + PROCESS_COUNT);
    console.log(req);
    request(req)
        .then(json => JSON.parse(json) as ToProcessList)
        .then(data => {
            data.body.forEach(element => {
                if (element.processMethod == METHOD_PROCESS_USER) {
                    const payload: ProcessUserInvocation = {
                        geek: element.geek,
                        url: element.url
                    };
                    return invokelambdaAsync("invokeProcessUser", OUTSIDE_PREFIX + FUNCTION_PROCESS_USER, payload);
                }
            })
        })
        .then(v => callback(undefined, v))
        .catch(err => {
            console.log(err);
            callback(err);
        });
}

// Lambda to harvest data about a user
export function processUser(event, context, callback: Callback) {
    console.log("processUser");
    console.log(event);
    const invocation = event as ProcessUserInvocation;

    request(invocation.url)
        .then(data => extractUserDataFromPage(invocation.geek, invocation.url, data.toString()))
        .then(result => {
            console.log(result);
            return result;
        })
        .then(result => invokelambdaAsync("processUser", INSIDE_PREFIX + FUNCTION_PROCESS_USER_RESULT, result))
        .then(v => callback(undefined, v))
        .catch(err => {
            console.log(err);
            callback(err);
        });
}

function extractUserDataFromPage(geek: string, url: string, pageContent: string): ProcessUserResult {
    const BEFORE_USER_IMAGE = "/images/user/";
    const BEFORE_COUNTRY = "/users?country=";
    const AFTER_USER_IMAGE = "/";
    const AFTER_COUNTRY = '"';

    let bggid = -1;
    let country = "";
    if (pageContent.indexOf(BEFORE_USER_IMAGE) >= 0) {
        const bggids = between(pageContent, BEFORE_USER_IMAGE, AFTER_USER_IMAGE);
        if (bggids) bggid = parseInt(bggids);
    }
    if (pageContent.indexOf(BEFORE_COUNTRY) >= 0) {
        country = between(pageContent, BEFORE_COUNTRY, AFTER_COUNTRY);
    }
    const result: ProcessUserResult = {
        geek: geek,
        url: url,
        country: country,
        bggid: bggid
    };
    return result;
}






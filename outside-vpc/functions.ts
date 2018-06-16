import {SNS, Lambda} from 'aws-sdk';
import {IncomingMessage} from "http";
import {Callback, Handler} from "aws-lambda";

const https = require('https');
const PROCESS_COUNT = 1;
const INSIDE_PREFIX = "inside-vpc-dev-";
const OUTSIDE_PREFIX = "outside-vpc-dev-";

// method names from the database - this is the type of thing we have to do.
const METHOD_PROCESS_USER = "processUser";

// lambda names we expect to see
const FUNCTION_PROCESS_USER = "processUser";

const FUNCTION_PROCESS_USER_RESULT = "processUserResult";

type GetProcessor = (response: IncomingMessage) => void;

interface ToProcessElement {
    filename: string,
    url: string,
    lastUpdate: any,
    processMethod: string,
    nextUpdate: any,
    geek: string,
    tillNextUpdate: any,
    description: string,
    lastattempt: any
}

interface ToProcessList {
    statusCode: number;
    body: [ToProcessElement];
}

interface ProcessUserInvocation {
    geek: string,
    url: string
}

interface ProcessUserResult {
    geek: string;
    bggid: number;
    country: string;
    url: string;
}

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export const readFromPastebin: Handler = (event, context, callback: Callback) => {
    console.log("SNS_ENDPOINT = " + process.env["SNS_ENDPOINT"]);
    const snsEndpoint = process.env["SNS_ENDPOINT"];
    const usersFile = process.env["USERS_FILE"];
    const sns = new SNS();

    https.get(usersFile, assemble((err, data) => {
        if (err) {
            console.log(err.stack);
            return;
        }
        sns.publish({
            Message: data.toString(),
            TargetArn: snsEndpoint
        }, function(err, data) {
            if (err) {
                console.log(err.stack);
                return;
            }
            console.log('Sent to SNS');
            console.log(data);
        });
    }));
};

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export const fireFileProcessing: Handler = (event, context, callback: Callback) => {
    console.log("fireFileProcessing");
    const request = makeAPIGetRequest("/v1/toProcess?count=" + PROCESS_COUNT);
    console.log(request);
    https.get(request, assembleJson((err, data) => {
        if (err) {
            console.log(err.stack);
            return;
        }
        console.log(data);
        const result = data as ToProcessList;
        result.body.forEach(element => {
            if (element.processMethod == METHOD_PROCESS_USER) {
                invokeProcessUser(element);
            }
        });
    }));
};

export const processUser: Handler = (event, context, callback: Callback) => {
    console.log("processUser");
    console.log(event);
    const invocation = event as ProcessUserInvocation;

    const BEFORE_USER_IMAGE = "/images/user/";
    const BEFORE_COUNTRY = "/users?country=";
    const AFTER_USER_IMAGE = "/";
    const AFTER_COUNTRY = '"';
    https.get(invocation.url, assemble((err, data) => {
        if (err) {
            console.log(err.stack);
            return;
        }
        let bggid = -1;
        let country = "";
        const file = data.toString();
        if (file.indexOf(BEFORE_USER_IMAGE) >= 0) {
            const bggids = between(file, BEFORE_USER_IMAGE, AFTER_USER_IMAGE);
            if (bggids) bggid = parseInt(bggids);
        }
        if (file.indexOf(BEFORE_COUNTRY) >= 0) {
            country = between(file, BEFORE_COUNTRY, AFTER_COUNTRY);
        }
        const result: ProcessUserResult = {
            geek: invocation.geek,
            url: invocation.url,
            country: country,
            bggid: bggid
        };
        console.log(result);
        invokelambdaAsync("processUser", INSIDE_PREFIX + FUNCTION_PROCESS_USER_RESULT, result);
    }));
};

function invokeProcessUser(toProcessElement: ToProcessElement) {
    const payload: ProcessUserInvocation = {
        geek: toProcessElement.geek,
        url: toProcessElement.url
    };
    invokelambdaAsync("invokeProcessUser", OUTSIDE_PREFIX + FUNCTION_PROCESS_USER, payload);
}

function invokelambdaAsync(context: string, func: string, payload: object) {
    const params = {
        ClientContext: context,
        FunctionName: func,
        InvocationType: "Event", // this is an async invocation
        LogType: "None",
        Payload: JSON.stringify(payload),
    };
    // const lambdaConfig: Lambda.ClientConfiguration = {
    //     apiVersion: '2015-03-31'
    // };
    const lambda = new Lambda();
    lambda.invoke(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log(func + " invoked apparently successfully");
            console.log(data);
        }
    });
}

function assembleJson(callback: Callback): GetProcessor {
    return assemble((error?: Error | null, result?: object) => {
        if (error) {
            callback(error)
        } else {
            callback(null, JSON.parse(result.toString()));
        }
    });
}

function assemble(callback: Callback): GetProcessor {
    return (response: IncomingMessage) => {
        const data: Buffer[] = [];
        response.on('error', (err: Error) => {
            console.log("got error in assemble");
            return callback(err);
        });
        response.on('data', (chunk: Buffer) => {
            data.push(chunk);
        });
        response.on('end', () => {
            callback(null, Buffer.concat(data));
        });
    }
}

function makeAPIGetRequest(path: string): object {
    const apiServer = process.env["apiServer"];
    const apiKey = process.env["apiKey"];
    return {
        method: "GET",
        protocol: "https:",
        hostname: apiServer,
        path: path,
        headers: {
            "x-api-key": apiKey
        }
    };
}

function between(s: string, before: string, after: string): string {
    const i = s.indexOf(before);
    if (i < 0) return "";
    s = s.substring(i+before.length);
    const j = s.indexOf(after);
    if (j < 0) return "";
    return s.substring(0, j);
}



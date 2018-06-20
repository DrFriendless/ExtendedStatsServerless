import {Lambda} from 'aws-sdk';
import {Callback} from "aws-lambda";

export function invokelambdaAsync(context: string, func: string, payload: object): Promise<void> {
    const params = {
        ClientContext: context,
        FunctionName: func,
        InvocationType: "Event", // this is an async invocation
        LogType: "None",
        Payload: JSON.stringify(payload),
    };
    const lambda = new Lambda();
    lambda.invoke(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log(func + " invoked apparently successfully");
            console.log(data);
        }
    });
    return Promise.resolve(payload);
}

export function invokelambdaSync(context: string, func: string, payload: object): Promise<object> {
    const params = {
        ClientContext: undefined,
        FunctionName: func,
        InvocationType: "RequestResponse", // this is a synchronous invocation
        LogType: "None",
        Payload: JSON.stringify(payload),
    };
    const lambda = new Lambda();
    return new Promise(function (fulfill, reject) {
        lambda.invoke(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                console.log(data);
                fulfill(JSON.parse(data.Payload.toString()));
            }
        });
    });
}

export function makeAPIGetRequest(path: string): object {
    const apiServer = process.env["apiServer"];
    const apiKey = process.env["apiKey"];
    return {
        url: 'https://' + apiServer + path,
        headers: {
            "x-api-key": apiKey
        }
    };
}

export function between(s: string, before: string, after: string): string {
    const i = s.indexOf(before);
    if (i < 0) return "";
    s = s.substring(i+before.length);
    const j = s.indexOf(after);
    if (j < 0) return "";
    return s.substring(0, j);
}

export function promiseToCallback<T>(promise: Promise<T>, callback: Callback) {
    promise
        .then(v => callback(undefined, v))
        .catch(err => callback(err));
}

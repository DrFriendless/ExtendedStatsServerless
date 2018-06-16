import {Lambda} from 'aws-sdk';

export function invokelambdaAsync(context: string, func: string, payload: object): Promise {
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

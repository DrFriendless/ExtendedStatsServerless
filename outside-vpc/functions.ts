import {SNS} from 'aws-sdk';
import {IncomingMessage} from "http";
import {Callback, Handler} from "aws-lambda";

const https = require('https');
const PROCESS_COUNT = 1;

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export const readFromPastebin: Handler = (event, context, callback: Callback) => {
    console.log("SNS_ENDPOINT = " + process.env["SNS_ENDPOINT"]);
    const snsEndpoint = process.env["SNS_ENDPOINT"];
    const usersFile = process.env["USERS_FILE"];
    const sns = new SNS();
    const data: Buffer[] = [];

    https.get(usersFile, (response: IncomingMessage) => {
        response.on('error', (err: Error) => { return callback(err) });
        response.on('data', (chunk: Buffer) => data.push(chunk));
        response.on('end', () => {
            const body = Buffer.concat(data).toString();
            sns.publish({
                Message: body,
                TargetArn: snsEndpoint
            }, function(err, data) {
                if (err) {
                    console.log(err.stack);
                    return;
                }
                console.log('Sent to SNS');
                console.log(data);
            });
        });
    });
};

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export const fireFileProcessing: Handler = (event, context, callback: Callback) => {
    const apiServer = process.env["apiServer"];
    const apiKey = process.env["apiKey"];
    const data: Buffer[] = [];
    const request = {
        method: "GET",
        protocol: "https:",
        hostname: apiServer,
        path: "/v1/toProcess?count=" + PROCESS_COUNT,
        headers: {
            "x-api-key": apiKey
        }
    };
    console.log("apiKey " + apiKey);
    console.log("apiServer " + apiServer);
    https.get(request, (response: IncomingMessage) => {
        response.on('error', (err: Error) => { return callback(err) });
        response.on('data', (chunk: Buffer) => data.push(chunk));
        response.on('end', () => {
            console.log(response);
            const body = Buffer.concat(data).toString();
            console.log(body);
            const obj = JSON.parse(body);
            console.log(obj);
        });
    });
};

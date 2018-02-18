import {SNS} from 'aws-sdk';
import {IncomingMessage} from "http";
import {Callback, Handler} from "aws-lambda";

const https = require('https');

// Lambda to get the list of users from pastebin and stick it on a queue to be processed.
export const readFromPastebin: Handler = (event, context, callback: Callback) => {
    console.log("SNS_ENDPOINT = " + process.env["SNS_ENDPOINT"]);
    const snsEndpoint = process.env["SNS_ENDPOINT"];
    const sns = new SNS();
    const data: Buffer[] = [];

    https.get("https://pastebin.com/raw/BvvdxzcH", (response: IncomingMessage) => {
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

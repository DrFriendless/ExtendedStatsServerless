import {SNS} from 'aws-sdk';
import {Callback, Handler} from 'aws-lambda';
import {ensureUsers, findProcessUserFiles, listUsers} from "./mysql-rds";

const PROFILE_URL = "https://boardgamegeek.com/user/";

// Lambda to get the list of users from an SQS queue and write it to Mongo DB.
export const writeToDB: Handler = (event, context, callback: Callback) => {
    const body = event.Records[0].Sns.Message;
    const usernames = body.split(/\r?\n/);
    console.log("checking for " + usernames.length + " users");
    ensureUsers(usernames);
};

function sendProcessUserToSNS(sns: SNS, endpoint: string): Callback {
    return function(error?: Error | null, result?: object) {
        console.log("inner");
        console.log(sns);
        console.log(endpoint);
        if (error) {
            console.log(error);
            return null;
        }
        const body = {
            url: result.url,
            geek: result.geek
        };
        console.log(body);
        sns.publish({
            Message: body.toString(),
            TargetArn: endpoint
        }, function(err, data) {
            if (err) {
                console.log(err);
                return;
            }
            console.log('Sent to SNS');
            return;
        });
    };
}

export const fireProcessUsers: Handler = (event, context, callback: Callback) => {
    console.log("SNS_ENDPOINT = " + process.env["SNS_ENDPOINT"]);
    const snsEndpoint = process.env["SNS_ENDPOINT"];
    const sns = new SNS();
    findProcessUserFiles(sendProcessUserToSNS(sns, snsEndpoint));
};

export const userlist: Handler = (event, context, callback: Callback) => {
    console.log("userlists");
    context.callbackWaitsForEmptyEventLoop = false;
    listUsers((err, result) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, { statusCode: 200, body: result });
        }
    });
};

import {Callback, Handler} from 'aws-lambda';
import {getConfig} from "./config";
import {ensureUser} from "./mysql-rds";

// Lambda to get the list of users from an SQS queue and write it to Mongo DB.
export const writeToDB: Handler = (event, context, callback: Callback) => {
    // const SnsMessageId = event.Records[0].Sns.MessageId;
    // const SnsPublishTime = event.Records[0].Sns.Timestamp;
    // const SnsTopicArn = event.Records[0].Sns.TopicArn;
    const body = event.Records[0].Sns.Message;
    console.log(body);
    const usernames = body.split(/\r?\n/);
    console.log("checking for " + usernames.length + " users");
    getConfig(config => {
        // usernames.forEach((username: string) => {
        //     ensureUser(config, username);
        // });
        ensureUser(config, "Friendless");
        ensureUser(config, "ferrao");
        ensureUser(config, "Critical Mass");
    });
};


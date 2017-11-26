// code to deal with MongoDB

import {Configuration} from "./config";
import {StitchClient} from "mongodb-stitch";

export const ensureUser: (config: Configuration, user: string) => void = (config: Configuration, user: string) => {
    const client = new StitchClient(config["mongoStitchID"]);
    client.login(config["mongoLogin"], config["mongoPwd"])
        .then(() => console.log('logged in as: ' + client.authedId()))
        .catch(e => console.log('error: ', e));
    const db = client.service('mongodb', 'mongodb1').db('Extended');
    const usersCollection = db.collection('users');
    let userId = client.authedId();
    usersCollection.insertMany([ { owner_id: userId, username: user } ])
        .then(result => console.log('success: ', result))
        .catch(e => console.log('error: ', e));
};

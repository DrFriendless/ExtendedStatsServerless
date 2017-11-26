// code to deal with MongoDB

import {Configuration} from "./config";
import {StitchClient} from "mongodb-stitch";

export const ensureUser: (config: Configuration, user: string) => void = (config: Configuration, user: string) => {
    const client = new StitchClient(config["mongoStitchID"]);
    console.log("mongo " + user);
};

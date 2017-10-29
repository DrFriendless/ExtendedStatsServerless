// code to deal with MongoDB

import {Configuration} from "./config";

const stitch = require("stitch");

export const ensureUser: (config: Configuration, user: string) => void = (config: Configuration, user: string) => {
    const client = new stitch.StitchClient(config["mongoStitchID"]);
    console.log("mongo " + user);
};

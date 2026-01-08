import express from "express";
import dotenv from "dotenv";
import path from "path";
import logger from "morgan";
import errorhandler from "errorhandler";
import cors from "cors";

import * as fs from "fs";

// Load environment variables from .env file, where API keys and passwords are configured for the development environment
dotenv.config({ path: ".env" });

import * as indexRoute from "./routes/index";
import * as findGeeksRoute from "./routes/findgeeks";
import * as countersRoute from "./routes/counters";

// Create Express server
const app = express();
app.set("port", process.env.PORT || 3000);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// tail -f /tmp/express.log
const accessLogStream = fs.createWriteStream(path.join("/tmp", 'express.log'), { flags: 'a' });
app.use(logger("dev", { stream: accessLogStream }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/findgeeks", cors(), findGeeksRoute.findgeeks);
app.post("/count", cors(), countersRoute.count);
app.get("/", indexRoute.index);

if (process.env.NODE_ENV === "development") {
    // only use in development
    app.use(errorhandler());
}

export default app;

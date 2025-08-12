import express from "express";
import dotenv from "dotenv";
import path from "path";
import logger from "morgan";
import errorhandler from "errorhandler";
import basicAuth from "express-basic-auth";
import cors from "cors";
import nocache from "nocache";

import * as fs from "fs";

// Load environment variables from .env file, where API keys and passwords are configured for the development environment
dotenv.config({ path: ".env" });

import * as indexRoute from "./routes/index";
import * as findGeeksRoute from "./routes/findgeeks";
import * as ensureGamesRoute from "./routes/ensuregames";
import * as auth from "./routes/auth";

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

const downloaderRouter = express.Router();
downloaderRouter.use(basicAuth({
    users: { "downloader": process.env.downloaderPassword }
}));
downloaderRouter.post("/ensuregames", ensureGamesRoute.ensuregames);
app.use("/downloader", downloaderRouter);

app.get("/findgeeks/:fragment", cors(), findGeeksRoute.findgeeks);
app.get("/login",
    nocache(),
    cors({origin: "https://extstats.drfriendless.com", credentials: true, exposedHeaders: "Set-Cookie"}),
    auth.login);
app.get("/", indexRoute.index);

if (process.env.NODE_ENV === "development") {
    // only use in development
    app.use(errorhandler());
}

export default app;

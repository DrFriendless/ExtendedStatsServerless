import express from "express";
import dotenv from "dotenv";
import path from "path";
import logger from "morgan";
import errorhandler from "errorhandler";

// Load environment variables from .env file, where API keys and passwords are configured
dotenv.config({ path: ".env.example" });

import * as indexRoute from "./routes/index";
import * as findGeeksRoute from "./routes/findgeeks";

// Create Express server
const app = express();
app.set("port", process.env.PORT || 3000);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/findgeeks/:fragment", findGeeksRoute.findgeeks);
app.get("/", indexRoute.index);

if (process.env.NODE_ENV === "development") {
    // only use in development
    app.use(errorhandler());
}

export default app;

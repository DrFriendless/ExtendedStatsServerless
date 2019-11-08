import { Request, Response } from "express";
import { IncomingHttpHeaders } from "http";
import { UserConfig, UserData } from "extstats-core";
import mysql = require('promise-mysql');
import { asyncReturnWithConnection } from "./library";

export async function login(req: Request, res: Response) {
    const cookies = getCookiesFromHeader(req.headers);
    console.log(req.headers);
    console.log(req.headers.cookie);
    console.log(cookies);

    const body = {};
    const id = cookies['extstatsid'];
    if (id) {
        const userData = await getUserDataForID(id);
        if (userData) Object.assign(body, userData);
        res.cookie("extstatsid", makeCookieValue(id));
    }
    res.send(body);
}

function makeCookieValue(id: string) {
    return id + "; Domain=drfriendless.com; Secure; Path=/; Max-Age=36000; SameSite=Lax; HttpOnly";
}

/**
 * Receives an array of headers and extract the value from the cookie header
 * @param  {String}   headers the headers from the request
 * @return {Object}
 */
export function getCookiesFromHeader(headers: IncomingHttpHeaders): Record<string, string> {
    if (!headers || !headers.cookie) return {};

    // Split a cookie string in an array (Originally found http://stackoverflow.com/a/3409200/1427439)
    const result: Record<string, string> = {};

    headers.cookie.split(';').forEach(function(cookie) {
        const parts = cookie.split('=');
        const key = parts.shift().trim();
        const value = decodeURI(parts.join('='));
        if (key !== '') result[key] = value;
    });
    return result;
}

async function getUserDataForID(sub: string): Promise<UserData | undefined> {
    const user = await findUser(sub);
    if (user) {
        return { first: user.isFirstLogin(), config: user.getConfig(), userName: user.getUsername() } as UserData;
    } else {
        return undefined;
    }
}

export async function findUser(identity: string): Promise<User | undefined> {
    return asyncReturnWithConnection(conn => doFindUser(conn, identity));
}

interface UserRow {
    identity: string;
    username: string;
    loginCount: number;
    created: Date;
    lastLogin: Date;
    configuration: string;
    icon: number;
    colour: number;
}

export async function doFindUser(conn: mysql.Connection, identity: string): Promise<User | undefined> {
    const findSql = "select * from users where identity = ?";
    const findResult = (await conn.query(findSql, [identity])).map((row: UserRow) => extractUser(row, false));
    if (findResult.length === 0) {
        return undefined;
    } else {
        const user = findResult[0];
        user.incrementLoginCount();
        await recordLoginForUser(conn, user);
        return user;
    }
}

async function recordLoginForUser(conn: mysql.Connection, user: User) {
    const updateSql = "update users set lastLogin = ?, loginCount = ? where identity = ?";
    await conn.query(updateSql, [new Date(), user.getLoginCount(), user.getIdentity()]);
}

function extractUser(row: UserRow, first: boolean): User {
    return new User(row["identity"], row["username"], row["loginCount"], first, row["created"], row["lastLogin"],
        row["configuration"], row["icon"], row["colour"]);
}

export class User {
    private readonly identity: string;
    private readonly username: string | undefined;
    private readonly configuration: UserConfig;
    private loginCount: number;
    private created: Date;
    private lastLogin: Date | undefined;
    private icon: number | undefined;
    private colour: number | undefined;
    private readonly firstLogin: boolean;

    constructor(identity: string, username: string, loginCount: number, firstLogin: boolean, created: Date,
                lastLogin: Date | undefined, configuration: string, icon: number, colour: number) {
        this.identity = identity;
        this.username = username;
        this.loginCount = loginCount;
        this.firstLogin = firstLogin;
        this.created = created;
        this.lastLogin = lastLogin;
        this.configuration = JSON.parse(configuration) as UserConfig;
        this.icon = icon;
        this.colour = colour;
    }

    public getUsername(): string | undefined {
        return this.username;
    }

    public isFirstLogin(): boolean {
        return this.firstLogin;
    }

    public getIdentity(): string {
        return this.identity;
    }

    public incrementLoginCount() {
        this.loginCount++;
    }

    public getLoginCount(): number {
        return this.loginCount;
    }

    public getConfig(): UserConfig {
        return this.configuration;
    }
}


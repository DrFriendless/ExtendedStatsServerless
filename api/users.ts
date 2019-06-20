import mysql = require('promise-mysql');
import { asyncReturnWithConnection } from "./library";
import { UserConfig } from "extstats-core";

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

// for GDPR requirements we need to provide the user with all data stored about them. However we do not need to
// present it in any particular fashion.
export async function retrieveAllData(identity: string): Promise<object> {
    const findSql = "select * from users where identity = ?";
    return asyncReturnWithConnection(async conn => {
        return await conn.query(findSql, [identity]);
    });
}

export async function findOrCreateUser(identity: string, suggestedUsername: string): Promise<User> {
    return asyncReturnWithConnection(conn => doFindOrCreateUser(conn, identity, suggestedUsername));
}

export async function findUser(identity: string): Promise<User | undefined> {
    return asyncReturnWithConnection(conn => doFindUser(conn, identity));
}

export async function updateUser(identity: string, userConfig: UserConfig) {
    return asyncReturnWithConnection(conn => doUpdateUserConfig(conn, identity, userConfig));
}

export async function doFindOrCreateUser(conn: mysql.Connection, identity: string, suggestedUsername: string): Promise<User> {
    const findSql = "select * from users where identity = ?";
    const createSql = "insert into users (identity, username, created) values (?,?,?)";
    const findResult = (await conn.query(findSql, [identity])).map(row => extractUser(row, false));
    if (findResult.length === 0) {
        await conn.query(createSql, [identity, suggestedUsername, new Date()]);
        return (await conn.query(findSql, [identity])).map(row => extractUser(row, true))[0];
    } else {
        const user = findResult[0];
        user.incrementLoginCount();
        await recordLoginForUser(conn, user);
        return user;
    }
}

export async function doFindUser(conn: mysql.Connection, identity: string): Promise<User | undefined> {
    const findSql = "select * from users where identity = ?";
    const findResult = (await conn.query(findSql, [identity])).map(row => extractUser(row, false));
    if (findResult.length === 0) {
        return undefined;
    } else {
        const user = findResult[0];
        user.incrementLoginCount();
        await recordLoginForUser(conn, user);
        return user;
    }
}

async function doUpdateUserConfig(conn: mysql.Connection, identity: string, userConfig: UserConfig) {
    const updateSql = "update users set configuration = ? where identity = ?";
    await conn.query(updateSql, [JSON.stringify(userConfig), identity]);
}

async function recordLoginForUser(conn: mysql.Connection, user: User) {
    const updateSql = "update users set lastLogin = ?, loginCount = ? where identity = ?";
    await conn.query(updateSql, [new Date(), user.getLoginCount(), user.getIdentity()]);
}

function extractUser(row: object, first: boolean): User {
    return new User(row["identity"], row["username"], row["loginCount"], first, row["created"], row["lastLogin"],
        row["configuration"], row["icon"], row["colour"]);
}

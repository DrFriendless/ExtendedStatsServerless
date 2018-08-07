import mysql = require('promise-mysql');
import {asyncReturnWithConnection} from "./library";

export class UserConfig {

}

export class User {
    private identity: string;
    private username: string | undefined;
    private configuration: UserConfig;
    private loginCount: number;
    private created: Date;
    private lastLogin: Date | undefined;
    private icon: number | undefined;
    private colour: number | undefined;

    constructor(identity: string, username: string, loginCount: number) {
        this.identity = identity;
        this.username = username;
        this.loginCount = loginCount;
    }

    public getUsername(): string {
        return this.username;
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
}

export async function findOrCreateUser(identity: string, suggestedUsername: string): Promise<User> {
    return asyncReturnWithConnection(conn => doFindOrCreateUser(conn, identity, suggestedUsername));
}

export async function doFindOrCreateUser(conn: mysql.Connection, identity: string, suggestedUsername: string): Promise<User> {
    const findSql = "select * from users where identity = ?";
    const createSql = "insert into users (identity, username, created) values (?,?,?)";
    const findResult = (await conn.query(findSql, [identity])).map(extractUser);
    if (findResult.length === 0) {
        await conn.query(createSql, [identity, suggestedUsername, new Date()]);
        return (await conn.query(findSql, [identity])).map(extractUser)[0];
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

function extractUser(row: object): User {
    return new User(row["identity"], row["username"], row["loginCount"]);
}

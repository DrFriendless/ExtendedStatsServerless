import { UserData } from "extstats-core";
import {APIGatewayProxyEvent} from "aws-lambda";
import {getCookiesFromEvent} from "./library.mjs";
import {findSystem, HttpResponse, isHttpResponse, System} from "./system.mjs";
import utf8 from 'utf8';
import {scryptSync} from "node:crypto";
import {
    confirmChangePassword,
    confirmSignup,
    createAuth,
    createAuthTask,
    deleteAuth, deleteAuthTask, doUpdateUserConfig, incrementLogin,
    loadAuth,
    loadAuthTask,
    loadAuthTasks
} from "./authdb.mjs";
import {AuthTask} from "./interfaces.mjs";
import {APIGatewayProxyEventV2WithRequestContext} from "aws-lambda/trigger/api-gateway-proxy.js";

const COST = 4096;
const SALT_LENGTH = 22;

function makeCookie(id: string, test: boolean) {
    if (test) {
        return "extstatsid=" + id + "; Domain=localhost; Path=/; Max-Age=360000; SameSite=Lax";
    } else {
        return "extstatsid=" + id + "; Domain=drfriendless.com; Path=/; Max-Age=360000; SameSite=Lax";
    }
}

function makeLogoutCookie(test: boolean) {
    if (test) {
        return "extstatsid=; Domain=localhost; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    } else {
        return "extstatsid=; Domain=drfriendless.com; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }
}

/**
 * If they have the extstatsid cookie, return their user data.
 * @param event
 */
export async function login(event: APIGatewayProxyEvent): Promise<HttpResponse> {
    console.log(event);
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    const body = JSON.parse(event.body) as any;
    const username = body['username'] || "";
    const password = body['password'] || "";

    const existing = await loadAuth(system, username);
    console.log(existing);
    if (!existing) {
        return {
            statusCode: 401,
            body: JSON.stringify({ state: "NEED_TO_SIGN_UP" })
        }
    }
    if (existing.status !== "CONFIRMED") {
        return {
            statusCode: 402,
            body: JSON.stringify({ state: "NOT_CONFIRMED" })
        }
    }
    const { salt, p } = extractSalt(existing.password);

    const hash = hashPasswordWithSalt(password, salt);
    if (hash !== existing.password) {
        return {
            statusCode: 403,
            body: JSON.stringify({ state: "WRONG_PASSWORD" })
        }
    }

    const cookie = makeCookie(username, event.headers.origin.includes("://localhost:"));
    await incrementLogin(system, username);
    const userData = await getUserDataForUsername(system, username);
    return { "statusCode": 200, headers: {"Set-Cookie": cookie}, body: JSON.stringify(userData) };
}

function makeid(length: number): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function hashPasswordWithSalt(password: string, salt: string): string {
    const u: string = utf8.encode(password);
    const uu = (u.length <= 72) ? u : u.substring(0, 72);
    const key = scryptSync(uu, salt, 64, { cost: COST });
    return `$2s$12$${salt}${key.toString('hex')}`;
}

function hashPassword(password: string) {
    const salt = makeid(SALT_LENGTH);
    return hashPasswordWithSalt(password, salt);
}

function extractSalt(encodedPassword: string): { salt: string, p: string } {
    const fields = encodedPassword.split("$");
    return { salt:  fields[3].substring(0, SALT_LENGTH), p: fields[3].substring(SALT_LENGTH) };
}

export async function changePassword(event: APIGatewayProxyEvent) {
    console.log(event);
    const system = await findSystem();
    if (isHttpResponse(system)) return system;

    const body = JSON.parse(event.body) as any;
    const username = body['username'] || "";
    const password = body['password'] || "";
    const existing = await loadAuth(system, username);
    if (!!existing) {
        if (existing.status !== "CONFIRMED") {
            return {
                statusCode: 403,
                body: JSON.stringify({ state: "NEED_TO_SIGN_UP" })
            }
        }
    } else if (!existing) {
        return {
            statusCode: 403,
            body: JSON.stringify({ state: "NEED_TO_SIGN_UP" })
        }
    }
    const hash = hashPassword(password);
    const b = { code: makeid(12) }
    await createAuthTask(system, { id: 0, created: new Date(), code: b.code, username, task: { type: "changePassword", password: hash } });
    return {
        "statusCode": 200,
        "body": JSON.stringify(b)
    }
}

export async function signup(event: APIGatewayProxyEvent) {
    console.log(event);
    const system = await findSystem();
    if (isHttpResponse(system)) return system;

    const body = JSON.parse(event.body) as any;
    const username = body['username'] || "";
    const password = body['password'] || "";
    const existing = await loadAuth(system, username);
    if (!!existing) {
        if (existing.status !== "CONFIRMED") {
            // guessing they can't confirm the previous attempt
            const existingTasks = (await loadAuthTasks(system, username)).filter(t => t.task.type === "signup");
            if (existingTasks.length === 1) {
                // tell them the code
                return {
                    "statusCode": 200,
                    "body": JSON.stringify({ code: existingTasks[0].code })
                }
            } else {
                // trash everything and start again
                await deleteAuth(system, username);
            }
        } else {
            return {
                statusCode: 403,
                body: JSON.stringify({ state: "ALREADY_SIGNED_UP" })
            }
        }
    }
    const hash = hashPassword(password);
    await createAuth(system, { username, password: hash, status: "WAITING", created: new Date(), loginCount: 0, configuration: {} });
    const b = {
        code: makeid(12)
    }
    await createAuthTask(system, { id: 0, created: new Date(), code: b.code, username, task: { type: "signup" } });
    return {
        "statusCode": 200,
        "body": JSON.stringify(b)
    }
}

export async function logout(event: APIGatewayProxyEvent): Promise<HttpResponse> {
    console.log(event);
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    const cookie = makeLogoutCookie(event.headers.origin.includes("://localhost:"));
    return { "statusCode": 200, headers: {"Set-Cookie": cookie}, body: JSON.stringify({}) };
}

export async function updatePersonal(event: APIGatewayProxyEventV2WithRequestContext<any>) {
    console.log(event);
    const system = await findSystem();
    if (isHttpResponse(system)) return system;

    const cookies = getCookiesFromEvent(event);
    console.log(cookies);
    if (cookies['extstatsid']) {
        await doUpdateUserConfig(system, cookies['extstatsid'], JSON.parse(event.body || "{}"));
        return { statusCode: 200 };
    } else {
        return { statusCode: 403 };
    }
}

async function confirmTask(system: System, task: AuthTask) {
    if (task.task.type === "signup") {
        await confirmSignup(system, task.username);
    } else if (task.task.type === "changePassword") {
        await confirmChangePassword(system, task.username, task.task.password);
    }
}

export async function confirm(event: { Payload: {id: string, username: string, codes: string[]}[] }) {
    console.log(event);
    const system = await findSystem();
    console.log(system);
    if (isHttpResponse(system)) return system;

    for (const row of event.Payload) {
        for (const code of row.codes) {
            const tasks = await loadAuthTask(system, row.username, code);
            console.log(tasks);
            for (const task of tasks) {
                await confirmTask(system, task);
                await deleteAuthTask(system, task.id);
            }
        }
    }
    return event.Payload;
}

async function getUserDataForUsername(system: System, username: string): Promise<UserData | undefined> {
    const user = await loadAuth(system, username);
    if (user) {
        return { config: user.configuration, userName: user.username, created: user.created,
            loginCount: user.loginCount, lastLogin: user.lastLogin } as UserData;
    } else {
        return undefined;
    }
}

export async function personal(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<HttpResponse> {
    const system = await findSystem();
    if (isHttpResponse(system)) return system;

    const cookies = getCookiesFromEvent(event);
    if (cookies['extstatsid']) {
        const user = await loadAuth(system, cookies['extstatsid']);
        if (!user) {
            return { "statusCode": 403, body: "{}" };
        } else {
            return { "statusCode": 200, body: user.configuration || "{}" };
        }
    } else {
        return { "statusCode": 403, body: "{}" };
    }
}

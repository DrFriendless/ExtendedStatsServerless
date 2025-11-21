import { Decoded, UserData, PersonalData, UserConfig } from "extstats-core";
import {APIGatewayProxyEvent} from "aws-lambda";
import {getCookiesFromHeader} from "./library.mjs";
import {findSystem, HttpResponse, isHttpResponse, System} from "./system.mjs";
import {findOrCreateUser, findUser, retrieveAllData, updateUser} from "./users.mjs";
import utf8 from 'utf8';
import {scryptSync} from "node:crypto";
import {createAuth, createAuthTask, deleteAuth, loadAuth, loadAuthTasks} from "./authdb.mjs";

const cost = 4096;

function makeCookie(id: string) {
    return "extstatsid=" + id + "; Domain=drfriendless.com; Secure; Path=/; Max-Age=36000; SameSite=Lax; HttpOnly";
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
            body: JSON.stringify({ message: "You need to sign up first." })
        }
    }
    if (existing.status !== "CONFIRMED") {
        return {
            statusCode: 402,
            body: JSON.stringify({ message: "Your account is not yet confirmed. Please complete the sign-up process, or wait till we catch up." })
        }
    }
    const hash = hashPassword(password);
    if (hash !== existing.password) {
        return {
            statusCode: 403,
            body: JSON.stringify({ message: "That's the wrong username or password." })
        }
    }
    const cookie = makeCookie(username);
    const userData = await getUserDataForID(system, username);
    return { "statusCode": 200, headers: {"Set-Cookie": cookie}, body: JSON.stringify(userData || {}) };
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

function hashPassword(password: string) {
    const u: string = utf8.encode(password);
    const uu = (u.length <= 72) ? u : u.substring(0, 72);
    const salt = makeid(22);
    const key = scryptSync(uu, salt, 64, { cost });
    return `$2s$12$${salt}${key.toString('hex')}`;
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
                    "body": JSON.stringify({ message: existingTasks[0].code })
                }
            } else {
                // trash everything and start again
                await deleteAuth(system, username);
            }
        } else {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: "You're already signed up. You can just login, or change your password if needed."})
            }
        }
    }
    const hash = hashPassword(password);
    await createAuth(system, { username, password: hash, status: "WAITING", created: new Date() });
    const b = {
        message: makeid(8)
    }
    await createAuthTask(system, { created: new Date(), code: b.message, username, task: { type: "signup" } });
    return {
        "statusCode": 200,
        "body": JSON.stringify(b)
    }
}

export async function logout(event: APIGatewayProxyEvent): Promise<HttpResponse> {
    console.log(event);
    const system = await findSystem();
    if (isHttpResponse(system)) return system;
    const cookies = getCookiesFromHeader(event.headers);
    // TODO
}

export async function updatePersonal(event: APIGatewayProxyEvent) {
    console.log(event);
    const system = await findSystem();
    if (isHttpResponse(system)) return system;

    const cookies = getCookiesFromHeader(event.headers);
    const headers = {
        "Access-Control-Allow-Origin": "https://extstats.drfriendless.com",
        "Access-Control-Allow-Credentials": true
    };
    if (cookies['extstatsid']) {
        await updateUser(system, cookies['extstatsid'], JSON.parse(event.body) as UserConfig);
        return { statusCode: 200, headers };
    } else {
        return { statusCode: 403, headers };
    }
}

async function getUserData(system: System, decoded: Decoded): Promise<UserData> {
    const user = await findOrCreateUser(system, decoded.sub, decoded.nickname);
    return { jwt: decoded, first: user.isFirstLogin(), config: user.getConfig(), userName: user.getUsername() } as UserData;
}

async function getUserDataForID(system: System, sub: string): Promise<UserData | undefined> {
    const user = await findUser(system, sub);
    if (user) {
        return { first: user.isFirstLogin(), config: user.getConfig(), userName: user.getUsername() } as UserData;
    } else {
        return undefined;
    }
}

async function getPersonalDataForID(system: System, sub: string): Promise<PersonalData> {
    const userData = await getUserDataForID(system, sub);
    const allData = await retrieveAllData(system, sub);
    return { userData, allData, error: undefined };
}

export async function personal(system: System, event: APIGatewayProxyEvent): Promise<HttpResponse> {
    const cookies = getCookiesFromHeader(event.headers);
    if (cookies['extstatsid']) {
        const body = JSON.stringify(await getPersonalDataForID(system, cookies['extstatsid']));
        const headers = {
            "Access-Control-Allow-Origin": "https://extstats.drfriendless.com",
            "Access-Control-Allow-Credentials": true
        };
        return { "statusCode": 200, body, headers };
    } else {
        return { "statusCode": 403, body: "{}" };
    }
}

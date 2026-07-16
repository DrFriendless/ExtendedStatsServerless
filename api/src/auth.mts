import {getCookiesFromEvent, getUserFromEvent} from "./library.mjs";
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
import {AuthTableRow, AuthTask} from "./interfaces.mjs";
import {APIGatewayProxyEventV2WithRequestContext} from "aws-lambda/trigger/api-gateway-proxy.js";
import {getChatterCode} from "./socks.mjs";
import {UserData} from "export";
import crypto from "crypto";

const COST = 4096;
const SALT_LENGTH = 22;

function makeIdCookie(id: string, test: boolean) {
    if (test) {
        return "extstatsid=" + id + "; Domain=localhost; Path=/; Max-Age=360000; SameSite=Lax";
    } else {
        return "extstatsid=" + id + "; Domain=drfriendless.com; Path=/; Max-Age=360000; SameSite=Lax";
    }
}

function makeSecureIdCookie(id: string, test: boolean) {
    const iv = crypto.randomBytes(12);
    const key = process.env.SECURE_COOKIE_KEY;
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encryptedCookie = Buffer.concat(
        [
            Buffer.from('v1:'), // prefix
            iv,                      // 12 bytes nonce
            cipher.update(id),       // cookie data
            cipher.final(),
            cipher.getAuthTag()      // 16 bytes authentication
        ]);
    const cookie = encryptedCookie.toString('base64');
    if (test) {
        return "extstatssec=" + cookie + "; Domain=localhost; Path=/; Max-Age=360000; SameSite=Strict; HttpOnly";
    } else {
        return "extstatssec=" + cookie + "; Domain=drfriendless.com; Path=/; Max-Age=360000; SameSite=Strict; HttpOnly; Secure";
    }
}

async function makeChatterCookie(geek: string, test: boolean) {
    const chatterId = await getChatterCode(geek);
    if (test) {
        return "extstatschatter=" + chatterId + "; Domain=localhost; Path=/; Max-Age=360000; SameSite=Lax";
    } else {
        return "extstatschatter=" + chatterId + "; Domain=drfriendless.com; Path=/; Max-Age=360000; SameSite=Lax";
    }
}

function makeLogoutCookie(test: boolean) {
    if (test) {
        return "extstatsid=; Domain=localhost; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    } else {
        return "extstatsid=; Domain=drfriendless.com; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }
}

function makeSecureLogoutCookie(test: boolean) {
    if (test) {
        return "extstatssec=; Domain=localhost; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; HttpOnly";
    } else {
        return "extstatssec=; Domain=drfriendless.com; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; HttpOnly; Secure";
    }
}

async function checkPassword(system: System, username: string, password: string): Promise<HttpResponse | AuthTableRow> {
    const existing = await loadAuth(system, username);
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
    return existing;
}

/**
 * @param event
 */
export async function login(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<HttpResponse> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    const body = JSON.parse(event.body) as any;
    const username: string = body['username'] || "";
    const password: string = body['password'] || "";
    const auth = await checkPassword(system, username, password);
    if (isHttpResponse(auth)) return auth;

    const test = !!event.headers.referer && event.headers.referer.indexOf("://localhost:") >= 0;
    const cookie = makeIdCookie(username, test);
    const secCookie = makeSecureIdCookie(username, test);
    const chatterCookie = await makeChatterCookie(username, test);
    await incrementLogin(system, username);
    const userData = await getUserDataForUsername(system, username);
    console.log([ test, cookie, secCookie, chatterCookie ]);
    return { "statusCode": 200, cookies: [cookie, secCookie, chatterCookie], body: JSON.stringify(userData) };
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

export async function changePassword(event: APIGatewayProxyEventV2WithRequestContext<any>) {
    console.log(event);
    const system = await findSystem("private");
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

export async function signup(event: APIGatewayProxyEventV2WithRequestContext<any>) {
    console.log(event);
    const system = await findSystem("private");
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

export async function logout(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<HttpResponse> {
    console.log(event);
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    const cookie = makeLogoutCookie(event.headers.origin.includes("://localhost:"));
    const secCookie = makeSecureLogoutCookie(event.headers.origin.includes("://localhost:"));
    return { "statusCode": 200, cookies: [cookie, secCookie], body: JSON.stringify({}) };
}

export async function updatePersonal(event: APIGatewayProxyEventV2WithRequestContext<any>) {
    console.log(event);
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;

    const user = getUserFromEvent(event);
    if (user) {
        const resp = await doUpdateUserConfig(system, user, JSON.parse(event.body || "{}"));
        if (resp) return resp;
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
    const system = await findSystem("private");
    console.log(system);
    if (isHttpResponse(system)) return system;
    console.log(JSON.stringify(event.Payload));

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
    console.log(JSON.stringify(event));
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;

    const user = getUserFromEvent(event);
    if (user) {
        const authRow = await loadAuth(system, user);
        if (!authRow) {
            return { "statusCode": 403, body: "{}" };
        } else {
            const test = !!event.headers.referer && event.headers.referer.indexOf("://localhost:") >= 0;
            const idCookie = makeIdCookie(user, test);
            const secureIdCookie = makeSecureIdCookie(user, test);
            const chatterCookie = await makeChatterCookie(user, test);
            console.log([ test, idCookie, chatterCookie ]);
            // to set multiple cookies, use a string[] rather than a string.
            return { "statusCode": 200, cookies: [ idCookie, secureIdCookie, chatterCookie ], body: authRow.configuration || "{}" };
        }
    } else {
        return { "statusCode": 403, body: "{}" };
    }
}

// authenticated user
export interface SecureUserData {
    user: string;
    data: any;
}

export async function getSecureUserData(system: System, event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<SecureUserData | undefined> {
    let userData: SecureUserData | undefined = undefined;
    const cookies = getCookiesFromEvent(event);
    const secureCookie = cookies['extstatssec'];
    // const insecureCookie = cookies['extstatsid'];
    let authHeader: string | undefined = undefined;
    for (const h in event.headers) {
        if (h.toLowerCase() === "authorization") {
            authHeader = event.headers[h];
            break;
        }
    }
    console.log(`authHeader ${authHeader}`);
    if (authHeader && authHeader.startsWith("Basic ")) {
        authHeader = authHeader.substring(6);
        const enc = Buffer.from(authHeader, 'base64').toString('ascii');
        if (enc.indexOf(':') > 0) {
            const pos = enc.indexOf(':');
            const user = enc.substring(0, pos);
            const p = enc.substring(pos+1);
            const auth = await checkPassword(system, user, p);
            if (!isHttpResponse(auth)) {
                const sData: string = auth.configuration || "{}";
                userData = { user, data: JSON.parse(sData) };
            }
        }
    }
    if (!userData && secureCookie) {
        const user = getUserFromSecureCookie(secureCookie);
        const sData: string = (await loadAuth(system, user))?.configuration || "{}";
        userData = { user, data: JSON.parse(sData) };
    }
    return userData;
}

export function getUserFromSecureCookie(secureCookie: string): string {
    const encryptedCookie = Buffer.from(secureCookie, 'base64');
    const key = process.env.SECURE_COOKIE_KEY;
    const prefix = encryptedCookie.subarray(0, 3);                            // prefix
    const iv = encryptedCookie.subarray(3, 3 + 12);                               // 12 bytes nonce
    const ciphertext = encryptedCookie.subarray(3 + 12, encryptedCookie.length - 16);  // encrypted cookie
    const authTag = encryptedCookie.subarray(encryptedCookie.length - 16);             // 12 bytes authentication tag
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(authTag, ));
    const decryptedCookie = Buffer.concat(
        [
            decipher.update(ciphertext),      // encrypted cookie
            decipher.final(),
        ]);
    return decryptedCookie.toString("utf8");
}
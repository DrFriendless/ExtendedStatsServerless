// import jwt = require("jsonwebtoken");
// import { findOrCreateUser, findUser, retrieveAllData, updateUser } from "./users.mjs";
import { Decoded, UserData, PersonalData, UserConfig } from "extstats-core";
import { getCookiesFromHeader } from "./library.mjs";
// import {VerifyOptions} from "jsonwebtoken";
import {APIGatewayProxyEvent} from "aws-lambda";
// import jwksClient = require('jwks-rsa');
// import {Jwk} from "jwks-rsa";
//
// const client = jwksClient({
//     jwksUri: 'https://drfriendless.au.auth0.com/.well-known/jwks.json'
// });

// this is the contents of a public file - Lambda can't access it from the URL unless I pay for a NAT gateway.
const jwks = {
    "keys": [
        {
            "alg": "RS256",
            "kty": "RSA",
            "use": "sig",
            "x5c": ["MIIDDTCCAfWgAwIBAgIJIMF/QrbM4dGoMA0GCSqGSIb3DQEBCwUAMCQxIjAgBgNVBAMTGWRyZnJpZW5kbGVzcy5hdS5hdXRoMC5jb20wHhcNMTgwNzA0MDY1NDMxWhcNMzIwMzEyMDY1NDMxWjAkMSIwIAYDVQQDExlkcmZyaWVuZGxlc3MuYXUuYXV0aDAuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA63saLsBd4ssvVgYMRDpvO5r0JoIMSLlligYFb7Rr0S0hXYa8hYJjtKjxvzhovNoQGbwE2wpkJ26TtKIt+fzJjWKOL3m5918ya4rSavI4dR/sdJt78qAzYUTJ54bu6TFj7X0r3zl6uovnYi+YeGpno/0IFW3IXKCPNcrvNBQmxysqr6+hgHlUw0QnHwYUUrLYs6om2VzT1PAJBEijQFb70mX+OTBiO3NTzREKDcMYIOJi2y+2arMV923iiebd714TQBk7pVNq44VjA2gFS+eC2Ju7Wp8y3m40IN52NvvwORAhlPvDAL4r2zx8RGLfvuMJcYaRVv6YKAqT6PuIZP9ACQIDAQABo0IwQDAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBQhk89ZTUB1316fmnqy1hoy20/4ZTAOBgNVHQ8BAf8EBAMCAoQwDQYJKoZIhvcNAQELBQADggEBAEgkMQh9XNg844naxUmCKIOUA9Z0ZY0lplWiIl1dbhdSmR0Zxe7r71y4weGiDd32G3MXhvJbrxwneXIP7aLWoP2zNsFgMAkd+7rBzkMmgWSAtUt54aNDYQl59kuqinWZDlM51pJx2vj8OShs3nMBV8iVPeBLrHHZQeRlW1Yl5dvPyQAbvYmlxFMDlmlBuB7prF964tWUC/f9r2eWEMEDDZW8V/iYxiqVhkdTbsM+s76n/dPNGh1RdgCp5owV8Ge9q2oS5wkIiumMNQ46odGK20ZlOJIpcc/fs13G03VR6W9r6hNaVeMCTysZstW+ylsNwY5cLt0gigL8ifj4Sd6nvkU="], "n":  "63saLsBd4ssvVgYMRDpvO5r0JoIMSLlligYFb7Rr0S0hXYa8hYJjtKjxvzhovNoQGbwE2wpkJ26TtKIt-fzJjWKOL3m5918ya4rSavI4dR_sdJt78qAzYUTJ54bu6TFj7X0r3zl6uovnYi-YeGpno_0IFW3IXKCPNcrvNBQmxysqr6-hgHlUw0QnHwYUUrLYs6om2VzT1PAJBEijQFb70mX-OTBiO3NTzREKDcMYIOJi2y-2arMV923iiebd714TQBk7pVNq44VjA2gFS-eC2Ju7Wp8y3m40IN52NvvwORAhlPvDAL4r2zx8RGLfvuMJcYaRVv6YKAqT6PuIZP9ACQ",
            "e": "AQAB",
            "kid": "QzlGODM4Q0Y2NkE4RUM1QUZCREQzNkJFNTJDNUUxQkU2MUU5MDIzMg",
            "x5t": "QzlGODM4Q0Y2NkE4RUM1QUZCREQzNkJFNTJDNUUxQkU2MUU5MDIzMg"
        }
    ]
};
const clientId = "z7FL2jZnXI9C66WcmCMC7V1STnQbFuQl";

async function withAuthentication(event: APIGatewayProxyEvent): Promise<Error | Decoded | undefined> {
    let token = (event["headers"]["Authorization"] as string).trim();
    if (token.slice(0, 7) === "Bearer ") {
        token = token.substring(7);
    } else {
        return new Error("No Authorization header");
    }
    // const options:  VerifyOptions = {
    //     algorithms: ["RS256"],
    //     issuer: ["https://drfriendless.au.auth0.com/"],
    //     audience: ["z7FL2jZnXI9C66WcmCMC7V1STnQbFuQl"] // this is the ID of the application in auth0
    // };
    let decoded: Decoded | undefined = undefined;
    try {
    //     jwt.verify(token, getKey, options, function (err, d: Decoded) {
    //         if (err) {
    //             console.log(err);
    //             throw err;
    //         } else {
    //             decoded = d;
    //         }
    //     });
        return decoded;
    } catch (err) {
        return Error(err.message);
    }
}

function makeCookie(id: string) {
    return "extstatsid=" + id + "; Domain=drfriendless.com; Secure; Path=/; Max-Age=36000; SameSite=Lax; HttpOnly";
}

/**
 * If they have the extstatsid cookie, return their user data.
 * @param event
 */
// export async function login(event: APIGatewayProxyEvent) {
//     const cookies = getCookiesFromHeader(event.headers);
//     const headers: Record<string, string> = {
//         "Access-Control-Allow-Origin": "https://extstats.drfriendless.com",
//         "Access-Control-Allow-Credentials": 'true',
//     };
//     const body = {};
//     if (cookies['extstatsid']) {
//         const cookie = makeCookie(cookies['extstatsid']);
//         const userData = await getUserDataForID(cookies['extstatsid']);
//         if (userData) {
//             Object.assign(body, userData);
//         }
//         headers["Set-Cookie"] = cookie;
//         headers["Access-Control-Expose-Headers"] = "Set-Cookie";
//     }
//     return { "statusCode": 200, headers, body: JSON.stringify(body) };
// }

/**
 * Receive the encoded JWT as the Authorization header and set the extstatsid cookie.
 * @param event
 */
// export async function authenticate(event: APIGatewayProxyEvent) {
//     const r: Error | Decoded | undefined = await withAuthentication(event);
//     if (r && "email" in r) {
//         const decoded: Decoded = r as Decoded;
//         const seconds = (new Date()).getTime() / 1000;
//         if (decoded["exp"] > seconds &&
//             // decoded["iss"] === "https://drfriendless.au.auth0.com/" &&
//             decoded["aud"] === clientId) {
//             const body = JSON.stringify(await getUserData(decoded));
//             // Chrome ignores the cookie if there's an Expires
//             // can't be HttpOnly as the browser needs to delete the cookie on a logout.
//             const cookie = makeCookie(decoded.sub);
//             const headers = {
//                 "Access-Control-Allow-Origin": "https://extstats.drfriendless.com",
//                 "Access-Control-Expose-Headers": "Set-Cookie",
//                 "Access-Control-Allow-Credentials": true,
//                 "Set-Cookie": cookie
//             };
//             return { "statusCode": 200, headers, body };
//         } else {
//             return { statusCode: 403, body: "Invalid JWT" };
//         }
//     } else {
//         const error: Error = r as Error;
//         if (error && error.name === "TokenExpiredError") {
//             return { statusCode: 403, body: "token expired" };
//         } else {
//             console.log(error);
//             return { statusCode: 403, body: error.toString() };
//         }
//     }
// }

// export async function updatePersonal(event: APIGatewayProxyEvent) {
//     console.log(event);
//     const cookies = getCookiesFromHeader(event.headers);
//     const headers = {
//         "Access-Control-Allow-Origin": "https://extstats.drfriendless.com",
//         "Access-Control-Allow-Credentials": true
//     };
//     if (cookies['extstatsid']) {
//         await updateUser(cookies['extstatsid'], JSON.parse(event.body) as UserConfig);
//         return { statusCode: 200, headers };
//     } else {
//         return { statusCode: 403, headers };
//     }
// }

// async function getUserData(decoded: Decoded): Promise<UserData> {
//     const user = await findOrCreateUser(decoded.sub, decoded.nickname);
//     return { jwt: decoded, first: user.isFirstLogin(), config: user.getConfig(), userName: user.getUsername() } as UserData;
// }

// async function getUserDataForID(sub: string): Promise<UserData | undefined> {
//     const user = await findUser(sub);
//     if (user) {
//         return { first: user.isFirstLogin(), config: user.getConfig(), userName: user.getUsername() } as UserData;
//     } else {
//         return undefined;
//     }
// }

// async function getPersonalDataForID(sub: string): Promise<PersonalData> {
//     const userData = await getUserDataForID(sub);
//     const allData = await retrieveAllData(sub);
//     return { userData, allData, error: undefined };
// }

// export async function personal(event: APIGatewayProxyEvent) {
//     const cookies = getCookiesFromHeader(event.headers);
//     if (cookies['extstatsid']) {
//         const body = JSON.stringify(await getPersonalDataForID(cookies['extstatsid']));
//         const headers = {
//             "Access-Control-Allow-Origin": "https://extstats.drfriendless.com",
//             "Access-Control-Allow-Credentials": true
//         };
//         return { "statusCode": 200, body, headers };
//     } else {
//         return { "statusCode": 403, body: "{}" };
//     }
// }

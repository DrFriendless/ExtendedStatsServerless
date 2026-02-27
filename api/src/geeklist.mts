import {APIGatewayProxyEventV2WithRequestContext} from "aws-lambda/trigger/api-gateway-proxy.js";
import {findSystem, HttpResponse, isHttpResponse} from "./system.mjs";
import {GeeklistCheck} from "./api-interfaces.mjs";
import {getCookiesFromEvent, sleep} from "./library.mjs";
import {XMLParser} from "fast-xml-parser";
import {InvokeCommand, InvokeCommandInput, LambdaClient} from "@aws-sdk/client-lambda";
import {fromUtf8, toUtf8} from "@aws-sdk/util-utf8-node";
import {retrieveGeekGames} from "./selector.mjs";
import {GeekGameRow} from "./interfaces.mjs";

export type PUBLIC_PRIVATE = "public" | "private";

export async function check(data: GeeklistData):
    Promise<GeeklistCheck | HttpResponse> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();

    const bggids = [...new Set(data.items.map(i => i.bggid))];
    const geekData = await system.asyncReturnWithConnection(conn => retrieveGeekGames(conn, bggids, data.geek));
    const index: Record<string, GeekGameRow> = {};
    geekData.forEach(gg => index[gg.bggid.toString()] = gg);
    return {
        geek: data.geek,
        geeklistId: data.geeklistId,
        items: data.items.map(i => {
            const gg = index[i.bggid.toString()];
            return {
            ...i,
            wtp: (gg && gg.wantToPlay) || false,
            wtb: (gg && gg.wantToBuy) || false,
            wit: (gg && gg.wantInTrade) || false,
            owned: (gg && gg.owned) || false,
            prevOwned: (gg && gg.prevOwned) || false,
            wishlist: (gg && gg.wish) || 0,
            rating: (gg && gg.rating) || -1
        }})
    };
}

async function fetchFromBGG(token: string, url: string): Promise<Response> {
    return fetch(url, {
        headers: {
            "Accept": "application/xml",
            "Authorization": `Bearer ${token}`,
        }
    });
}

async function fetchXMLFromBGG(token: string, url: string): Promise<string | HttpResponse> {
    let resp = await fetchFromBGG(token, url);
    console.log(resp.url, resp.status);
    if (!resp.ok) {
        console.log(JSON.stringify(resp));
        return {
            statusCode: resp.status,
            body: JSON.stringify(resp.body)
        };
    }
    let count = 0;
    while (resp.status === 202 && count < 3) {
        count++;
        await sleep(5000);
        resp = await fetchFromBGG(token, url);
    }
    if (count === 3) {
        return {
            statusCode: 503,
            body: JSON.stringify("BGG didn't supply the geeklist in time")
        };
    }
    const xml = await resp.text();
    if (xml.indexOf("Rate limit exceeded") >= 0) {
        console.log(`Rate limit exceeded downloading ${url}`);
        return {
            statusCode: 500,
            body: JSON.stringify("BGG says I'm doing this too much, please try again shortly")
        }
    }
    return xml;
}

interface ParsedGeeklist {
    geeklist: {
        item: {
            "@_id": string;
            "@_subtype": string;
            "@_username": string;
            "@_objectid": string;
            "@_objectname": string;
        }[];
    }
}

interface GeeklistItem {
    id: string;
    bggid: number;
    name: string;
    user: string;
}

interface GeeklistData {
    geek: string;
    geeklistId: number;
    items: GeeklistItem[]
}

export async function downloader(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<HttpResponse | GeeklistCheck> {
    const system = await findSystem("public");
    if (isHttpResponse(system)) return system;
    console.log(JSON.stringify(event));

    const geeklist = event.queryStringParameters.geeklist;
    if (!geeklist) {
        return {
            statusCode: 400,
            body: JSON.stringify("You must specify a 'geeklist' parameter.")
        }
    }
    try {
        const n = parseInt(geeklist);
        if (n.toString() !== geeklist) {
            return {
                statusCode: 400,
                body: JSON.stringify("The geeklist ID looks wrong.")
            }
        }
    } catch (err) {
        return {
            statusCode: 400,
            body: JSON.stringify("The geeklist ID looks wrong.")
        }
    }
    const cookies = getCookiesFromEvent(event);
    if (!cookies['extstatsid']) {
        return {
            statusCode: 400,
            body: JSON.stringify("You must be logged in to use this feature.")
        }
    }
    const geek = cookies['extstatsid'];

    const url = `https://boardgamegeek.com/xmlapi/geeklist/${geeklist}`;
    const xml = await fetchXMLFromBGG(system.geeklistToken,  url);
    if (isHttpResponse(xml)) return xml;

    const parser = new XMLParser({
        ignoreAttributes: false, trimValues: true,
        isArray: (name, jpath, isLeafNode, isAttribute) => {
            if (["play","subtype","player","comments"].indexOf(name) >= 0) return true;
            if (["item","players","subtypes","body"].indexOf(name) >= 0) return false;
            if (name.startsWith("@_") || name.startsWith("?")) return false;
            return false;
        }
    });
    const doc: ParsedGeeklist = parser.parse(xml);
    const gl = doc.geeklist;
    const items: GeeklistItem[] = [];
    for (const item of gl.item) {
        if (item["@_subtype"] === "boardgame") {
            items.push({
                name: item["@_objectname"],
                bggid: parseInt(item["@_objectid"]),
                user: item["@_username"],
                id: item["@_id"]
            });
        }
    }
    const data: GeeklistData = {
        geek,
        geeklistId: parseInt(geeklist),
        items
    };

    const lambdaClient = new LambdaClient({});
    // Payload of InvokeCommandInput is of type Uint8Array
    const params: InvokeCommandInput = {
        FunctionName: 'api_geeklist_check',
        InvocationType: 'RequestResponse',
        Payload: fromUtf8(JSON.stringify(data)),
    };
    const result = await lambdaClient.send(new InvokeCommand(params));
    const payload = JSON.parse(toUtf8(result.Payload));
    return payload as GeeklistCheck;
}
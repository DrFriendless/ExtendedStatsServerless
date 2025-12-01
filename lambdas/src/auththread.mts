import {APIGatewayProxyEvent} from "aws-lambda";
import {findSystem, HttpResponse, isHttpResponse} from "./system.mjs";
import {XMLParser} from "fast-xml-parser";
import {PutParameterCommand, SSMClient} from "@aws-sdk/client-ssm";

export async function handler(event: APIGatewayProxyEvent): Promise<any[] | HttpResponse> {
    console.log(event);
    const system = await findSystem(["bgg"]);
    if (isHttpResponse(system)) return system;

    const url = `${system.authcheckThread}&minarticleid=${system.minarticleid}`;
    console.log(url);
    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${system.forumChecker}`,
            "Accept": "application/xml"
        }
    });
    if (!response.ok) {
        console.log(response);
        return;
    }
    const xml = await response.text();
    console.log(xml);
    const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
    let doc = parser.parse(xml);
    let articles: any[] = doc.thread.articles.article;
    const result = [];
    let latestId = undefined;
    if ("subject" in articles) articles = [ articles ];
    for (const a of articles) {
        const username = a["@_username"];
        const id = a["@_id"];
        console.log(a.body);
        const codes = findCodes(a.body);
        console.log(codes);
        if (codes.length > 0) {
            result.push({ id, username, codes });
        }
        latestId = id;
    }
    if (latestId) {
        const ssmClient = new SSMClient({
            apiVersion: '2014-11-06',
            region: process.env.AWS_REGION
        });
        const response = await ssmClient.send(
            new PutParameterCommand({
                Value: latestId,
                Name: "/extstats/authcheck/minarticleid",
                Overwrite: true
            })
        );
        console.log(response);
    }
    console.log(result);
    return result;
}

function findCodes(body: string): string[] {
    let b = body.replace(/</g, " ");
    b = b.replace(/>/g, " ");
    return b.split(/\s+/, 500).filter(s => /^([A-Za-z0-9]{12})$/.test(s));
}
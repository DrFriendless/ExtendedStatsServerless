import {LambdaClient, InvokeCommand} from "@aws-sdk/client-lambda";
const INSIDE_PREFIX = "inside-dev-";

export function logError(message: string): Promise<void> {
    return invokeLambdaAsync(INSIDE_PREFIX + "logError", { source: "downloader", message });
}

export async function invokeLambdaAsync(func: string, payload: object): Promise<void> {
    const lambda = new LambdaClient({ region: process.env.REGION });
    const command = new InvokeCommand({
        FunctionName: func,
        Payload: JSON.stringify(payload),
        InvocationType: "Event"
    });
    try {
        const resp = await lambda.send(command);
        console.log(resp);
    } catch (error) {
        console.log(error);
    }
}

export async function invokeLambdaSync(func: string, payload: object): Promise<object> {
    const lambda = new LambdaClient({ region: process.env.REGION });
    const command = new InvokeCommand({
        FunctionName: func,
        Payload: JSON.stringify(payload),
        InvocationType: "RequestResponse"
    });
    try {
        const data = await lambda.send(command);
        console.log(data);
        return data.Payload;
    } catch (error) {
        console.log(error);
    }
}

export function between(s: string, before: string, after: string): string {
    const i = s.indexOf(before);
    if (i < 0) return "";
    s = s.substring(i + before.length);
    const j = s.indexOf(after);
    if (j < 0) return "";
    return s.substring(0, j);
}

export function btoa(s: string) {
    return Buffer.from(s, 'binary').toString('base64');
}
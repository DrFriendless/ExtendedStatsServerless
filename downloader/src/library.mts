import {LambdaClient, InvokeCommand} from "@aws-sdk/client-lambda";

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

export function splitYmd(ymd: string): { y: number; m: number; d: number } {
    const f = ymd.split("-");
    if (f.length !== 3) return undefined;
    const y = parseInt(f[0]);
    const m = parseInt(f[1]);
    const d = parseInt(f[2]);
    return { y, m, d };
}

export function toYMDString(y: number, m: number, d: number): string {
    return y.toString() + (m < 10 ? "0" + m : m) + (d < 10 ? "0" + d : d);
}

export function between(s: string, before: string, after: string): string {
    const i = s.indexOf(before);
    if (i < 0) return "";
    s = s.substring(i + before.length);
    const j = s.indexOf(after);
    if (j < 0) return "";
    return s.substring(0, j);
}

export async function sleep(waitTimeInMs: number){
   await new Promise(resolve => setTimeout(resolve, waitTimeInMs));
}
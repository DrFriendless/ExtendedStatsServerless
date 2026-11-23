import {RequestStats} from "./interfaces.mjs";
import {InvokeCommand, LambdaClient} from "@aws-sdk/client-lambda";

export function splitYmd(ymd: string): { y: number; m: number; d: number } {
    const f = ymd.split("-");
    if (f.length !== 3) return undefined;
    const y = parseInt(f[0]);
    const m = parseInt(f[1]);
    const d = parseInt(f[2]);
    return { y, m, d };
}

export function between(s: string, before: string, after: string): string {
    const i = s.indexOf(before);
    if (i < 0) return "";
    s = s.substring(i + before.length);
    const j = s.indexOf(after);
    if (j < 0) return "";
    return s.substring(0, j);
}

// copy the stats from the source, and optionally update some
export function copyRequestStats(src: RequestStats, extra?: Partial<RequestStats>): RequestStats {
    const x = { initiated: src.initiated, completed: src.completed, downloaded: src.downloaded, received: src.received,
        scheduled: src.scheduled, requestId: src.requestId };
    if (extra) Object.assign(x, extra);
    return x;
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
    } catch (error) {
        console.log(error);
    }
}

export function cdf(n: number, lambda: number) {
    return 1.0 - Math.exp(-lambda * n);
}

export function invcdf(n: number, lambda: number) {
    return -Math.log(1 - n) / lambda;
}

export function listMinus(ints: number[], takeaway: number[]): number[] {
    return ints.filter(x => takeaway.indexOf(x) < 0);
}

export function listIntersect(ints: number[], other: number[]): number[] {
    return ints.filter(x => other.indexOf(x) >= 0);
}

export function listAdd(ints: number[], other: number[]) {
    for (const i of other) {
        if (!ints.includes(i)) ints.push(i);
    }
}

export function eqSet(as: Set<number>, bs: Set<number>): boolean {
    if (as.size !== bs.size) return false;
    for (const a of as) if (!bs.has(a)) return false;
    return true;
}

export function splitBy<T>(items: T[], iteratee: (value: T) => string): T[][] {
    return Object.values(groupBy(items, iteratee));
}

export function groupBy<T>(items: T[], sortFunc: (x: T) => string): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const item of items) {
        const s = sortFunc(item);
        if (!result.hasOwnProperty(s)) {
            result[s] = [];
        }
        result[s].push(item);
    }
    return result;
}

export function parseYmd(ymd: string): Date | undefined {
    const s = splitYmd(ymd);
    if (!s) return undefined;
    const { y, m, d } = s;
    const result = new Date();
    result.setFullYear(y);
    result.setMonth(m-1);
    result.setDate(d);
    return result;
}

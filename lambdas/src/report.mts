import {findSystem, HttpResponse, isHttpResponse} from "./system.mjs";
import {flushLogging, initLogging, log} from "./logging.mjs";
import {Connection} from "promise-mysql";

interface Query1Result { c: number; processMethod: string }

export async function handler(ignored: any): Promise<string[] | HttpResponse> {
    const system = await findSystem(["db"]);
    if (isHttpResponse(system)) return system;

    const rows: string[] = [];
    const { data1, data2, data3 } = await system.asyncReturnWithConnection(async (conn: Connection) => {
        const data1 = (await conn.query("select count(id) c, processMethod from files where lastUpdate is null group by processMethod")) as Query1Result[];
        const data2 = (await conn.query("select count(id) c, processMethod from files where lastUpdate is not null and nextUpdate < now() group by processMethod")) as Query1Result[];
        const data3 = (await conn.query("select count(id) c, processMethod from files where lastUpdate is not null and nextUpdate > now() and nextUpdate < addtime(now(),'24:00:00') group by processMethod;")) as Query1Result[];
        return { data1, data2, data3 };
    });
    for (const row of data1) {
        rows.push(`There are ${row.c} never-processed files with method ${row.processMethod}.`);
        console.log(`There are ${row.c} never-processed files with method ${row.processMethod}.`);
    }
    for (const row of data2) {
        rows.push(`There are ${row.c} processed files with method ${row.processMethod} that are due for an update.`);
        console.log(`There are ${row.c} processed files with method ${row.processMethod} that are due for an update.`);
    }
    for (const row of data3) {
        rows.push(`There are ${row.c} processed files with method ${row.processMethod} that will become due for an update in the next 24 hours.`);
        console.log(`There are ${row.c} processed files with method ${row.processMethod} that will become due for an update in the next 24 hours.`);
    }
    return rows;
}

export async function write(event: { Payload: string[] }): Promise<void | HttpResponse> {
    console.log(event);
    const system = await findSystem(["logging"]);
    if (isHttpResponse(system)) return system;
    console.log(`The report will go to an event called 'report' in log group ${system.systemLogGroup}.`);
    await initLogging(system, "report");
    for (const r of event.Payload) {
        log(r);
    }
    await flushLogging();
}
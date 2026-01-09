import {findSystem, HttpResponse, isHttpResponse} from "./system.mjs";

interface Counters {
    page_views: number;
    blog_views: number;
    downloader_processed: number;
    api_calls: number;
    slowdowns: number;
    downloader_unknown: number;
    express_calls: number;
}

interface ToProcess {
    processCollection?: number;
    processPlayed?: number;
    processYear?: number;
    processGame?: number;
}

interface ToProcessRow {
    c: number;
    processMethod: keyof ToProcess
}

export async function handler(ignored: any): Promise<void | HttpResponse> {
    const system = await findSystem(["db"]);
    if (isHttpResponse(system)) return system;

    await system.asyncWithConnection(async conn => {
        const counters = (await conn.query("select * from counters"))[0] as Counters;
        const auth: number = (await conn.query("select count(*) c from auth"))[0].c;
        const authTasks: number = (await conn.query("select count(*) c from authtask"))[0].c;
        const tp = (await conn.query("select count(id) c, processMethod from files where ((lastUpdate is null) or (lastUpdate is not null and nextUpdate < now())) group by processMethod")) as ToProcessRow[];
        const toProcess: Partial<ToProcess> = Object.fromEntries(tp.map(r => [r.processMethod, r.c]));
        const plays = (await conn.query("select count(*) c from plays"))[0].c;
        const notGeeks = (await conn.query("select count(*) c  from not_geeks"))[0].c;
        const notGames = (await conn.query("select count(*) c from not_games"))[0].c;
        const insertSql = "insert into metrics (timestamp, page_views, blog_views, downloader_processed, api_calls, slowdowns, downloader_unknown, express_calls, process_collection, process_played, process_year, process_game, auth_count, auth_task_count, plays_count, not_geeks_count, not_games_count) values (now(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        const values: number[] = [ counters.page_views, counters.blog_views, counters.downloader_processed, counters.api_calls, counters.slowdowns, counters.downloader_unknown,
            counters.express_calls, toProcess.processCollection || 0, toProcess.processPlayed || 0, toProcess.processYear || 0, toProcess.processGame || 0,
            auth, authTasks, plays, notGeeks, notGames];
        await conn.query(insertSql, values);
    });
}
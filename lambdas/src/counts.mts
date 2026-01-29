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

interface CloudWatchPayload {
    dl_opt_age: number;
    dl_opt_length: number;
    dl_plays_age: number;
    dl_plays_length: number;
    dl_retry_length: number;
    db_cpu: number;
    db_credit: number;
    eb2_cpu: number;
}

export async function handler(event: { Payload: CloudWatchPayload }): Promise<void | HttpResponse> {
    console.log(event.Payload);
    const cw = event.Payload;
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
        const latest = (await conn.query("select * from metrics order by timestamp desc limit 1"))[0];
        console.log(latest);
        const delta_downloader_processed = counters.downloader_processed - latest.downloader_processed;
        const delta_slowdowns = counters.slowdowns - latest.slowdowns;
        const delta_page_views = counters.page_views - latest.page_views;
        const delta_blog_views = counters.blog_views - latest.blog_views;
        const delta_plays = plays - latest.plays_count;
        const delta_api_calls = counters.api_calls - latest.api_calls;
        const delta_express_calls = counters.express_calls - latest.express_calls;
        console.log(delta_downloader_processed, delta_slowdowns, delta_page_views, delta_blog_views, delta_plays, delta_api_calls, delta_express_calls);
        const insertSql = "insert into metrics (timestamp, page_views, blog_views, downloader_processed, api_calls, slowdowns, downloader_unknown, express_calls, process_collection, process_played, process_year, process_game, auth_count, auth_task_count, plays_count, not_geeks_count, not_games_count, dl_opt_age, dl_opt_length, dl_plays_age, dl_plays_length, dl_retry_length, db_cpu, db_credit, eb2_cpu, delta_downloader_processed, delta_slowdowns, delta_page_views, delta_blog_views, delta_plays, delta_api_calls, delta_express_calls) values (now(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        const values: number[] = [ counters.page_views, counters.blog_views, counters.downloader_processed, counters.api_calls, counters.slowdowns, counters.downloader_unknown,
            counters.express_calls, toProcess.processCollection || 0, toProcess.processPlayed || 0, toProcess.processYear || 0, toProcess.processGame || 0,
            auth, authTasks, plays, notGeeks, notGames, cw.dl_opt_age, cw.dl_opt_length, cw.dl_plays_age, cw.dl_plays_length, cw.dl_retry_length, cw.db_cpu, cw.db_credit, cw.eb2_cpu,
            delta_downloader_processed, delta_slowdowns, delta_page_views, delta_blog_views, delta_plays, delta_api_calls, delta_express_calls];
        await conn.query(insertSql, values);
    });
}
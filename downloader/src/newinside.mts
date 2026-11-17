import {isHttpResponse} from "./system.mjs";
import {InsideSystem, loadInsideSystem} from "./insidesystem.mjs";
import {getGeekId} from "./mysql-rds.mjs";

export interface PlayedYearsEvent {
    geek: string;
    geekid: number;
    fileId: number;
}

// Lambda entry point.
export async function handleUpdatePlayedYears(event: PlayedYearsEvent): Promise<void> {
    const system = await loadInsideSystem();
    if (isHttpResponse(system)) {
        console.log(JSON.stringify(system));
        return;
    }
    return await updatePlayedYears(system, event.geek, event.geekid, event.fileId);
}

async function updatePlayedYears(system: InsideSystem, geek: string, nonsense: number, fileId: number) {
    const sql = "delete from files where processMethod = 'processPlays' and geek = ?";
    await system.asyncWithConnection(conn => conn.query(sql, [ geek ]));
    const geekid: number = await system.asyncReturnWithConnection(async conn => await getGeekId(conn, geek));
    const thisYear = (new Date()).getFullYear();

    const periods = [
        { start: "0000-0-0", end: "1979-12-31" },
        { start: "1980-0-0", end: "1989-12-31" },
        { start: "1990-0-0", end: "1999-12-31" },
    ];
    let y = 2000;
    while (y <= thisYear) {
        periods.push({ start: `${y}-0-0`, end: `${y}-12-31` });
        y++;
    }
    console.log(JSON.stringify(periods));
    const index = (await system.asyncReturnWithConnection(async conn => {
        return [...await conn.query("select trim(url) u from files where processMethod = 'processYear' and geek = ?", [geek])] as { u: string }[];
    })).map(row => row.u);
    for (const p of periods) {
        const range = `${p.start}=${p.end}=${geek}`;
        if (index.indexOf(range) >= 0) continue;
        const year = parseInt(p.start.substring(0, 4));
        const insertSql = "insert into files (url, processMethod, geek, geekid, lastupdate, tillNextUpdate, description, bggid, year) values (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        const insertParams = [range, "processYear", geek, geekid, null, null, `Plays from ${p.start} until ${p.end}`, 0, year];
        await system.asyncWithConnection(async conn => await conn.query(insertSql, insertParams));
    }
    const nextUpdate = new Date();
    nextUpdate.setFullYear(thisYear + 1);
    nextUpdate.setMonth(0);
    nextUpdate.setDate(2);
    const updateSql = "update files set nextUpdate = ?, lastUpdate = ?, geekid = ? where id = ?";
    const updateParams = [ nextUpdate, new Date(), geekid, fileId ];
    await system.asyncWithConnection(async conn => await conn.query(updateSql, updateParams));
}
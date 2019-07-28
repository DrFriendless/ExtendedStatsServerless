import * as mysql from "promise-mysql";
import { asyncReturnWithConnection, count, countTableRows, getGeekId, getGeekIds } from "./library";
import { selectGames } from "./selector";
import { RankingTableRow, GameData, ExpansionData, GeekGameQuery, Collection, CollectionWithPlays, GamePlays, SystemStats,
    TypeCount, WarTableRow, GeekSummary, FAQCount, CollectionWithMonthlyPlays, MonthlyPlays, NewsItem, PlaysQuery,
    MultiGeekPlays, PlaysWithDate, MonthlyPlayCount, ToProcessElement } from "extstats-core";
import * as moment from "moment";

export async function rankGames(query: object): Promise<RankingTableRow[]> {
    return await asyncReturnWithConnection(async conn => await doRankGames(conn, query));
}

async function doRankGames(conn: mysql.Connection, query: object): Promise<RankingTableRow[]> {
    const sql = "select game, game_name, total_ratings, num_ratings, bgg_ranking, bgg_rating, normalised_ranking, total_plays, hindex, gindex from ranking_table order by total_ratings desc limit 1000";
    const rows = await conn.query(sql);
    let ranking = 1;
    rows.forEach(row => {
        row.ranking = ranking;
        ranking++;
    });
    return rows;
}

export async function doRetrieveGames(conn: mysql.Connection, ids: number[]): Promise<GameData[]> {
    const sqlOne = "select * from games where bggid = ?";
    const sqlMany = "select * from games where bggid in (?)";
    const expansions = await loadExpansionData(conn);
    let rows;
    if (ids.length === 0) return [];
    if (ids.length === 1) {
        rows = await conn.query(sqlOne, ids);
    } else {
        rows = await conn.query(sqlMany, [ids]);
    }
    return rows.map(row => extractGameData(row, expansions));
}

function extractGameData(row: object, expansionData: ExpansionData): GameData {
    return { bggid: row["bggid"], bggRanking: row["rank"], bggRating: row["average"], minPlayers: row["minPlayers"],
        maxPlayers: row["maxPlayers"], name: row["name"], playTime: row["playTime"], subdomain: row["subdomain"],
        weight: row["averageWeight"], yearPublished: row["yearPublished"], isExpansion: expansionData.isExpansion(row["bggid"]) } as GameData;
}

export async function doGetNews(conn: mysql.Connection): Promise<NewsItem[]> {
    const sql = "select id, published date, message html from news order by published desc limit 10";
    return (await conn.query(sql)).map(it => it as NewsItem);
}

export async function doQuery(conn: mysql.Connection, query: GeekGameQuery):
    Promise<Collection | CollectionWithPlays | CollectionWithMonthlyPlays> {
    const queryResult = await selectGames(conn, query, query.query);
    const geekGames = queryResult.geekGames.map(gg => gg.bggid);
    const games = await doRetrieveGames(conn, geekGames);
    let extra;
    if (query.extra) {
        extra = (await selectGames(conn, query, query.extra)).geekGames.map(gg => gg.bggid);
    }
    switch (query.format) {
        case "Collection": {
            return { collection: queryResult.geekGames, games, metadata: queryResult.metadata, extra } as Collection;
        }
        case "CollectionWithPlays": {
            const plays = (await getAllPlays(conn, query.geek)).filter(gp => geekGames.indexOf(gp.game) >= 0);
            const lastYearPlays = (await getLastYearOfPlays(conn, query.geek)).filter(gp => geekGames.indexOf(gp.game) >= 0);
            return { collection: queryResult.geekGames, plays, games, lastYearPlays, metadata: queryResult.metadata, extra } as CollectionWithPlays;
        }
        case "CollectionWithMonthlyPlays": {
            const plays = (await getMonthlyPlays(conn, query.geek)).filter(gp => geekGames.indexOf(gp.game) >= 0);
            const counts = (await getMonthlyCounts(conn, query.geek));
            const result: CollectionWithMonthlyPlays = {
                collection: queryResult.geekGames, plays, games, metadata: queryResult.metadata, extra, counts
            };
            return result;
        }
        default: {
            return { collection: queryResult.geekGames, games, metadata: queryResult.metadata, extra } as Collection;
        }
    }
}

type ShellBeRight = { [geek: string]: PlaysWithDate[] };

export async function doPlaysQuery(conn: mysql.Connection, query: PlaysQuery): Promise<MultiGeekPlays> {
    const geeks = query.geeks || [query.geek];
    const geekNameIds: { [id: number]: string } = await getGeekIds(conn, geeks);
    if (Object.values(geekNameIds).length === 0) {
        return { geeks: [], plays: {}, collection: [], games: [] };
    }
    let where = "geek in (?)";
    const args: any[] = [ Object.keys(geekNameIds).map(s => parseInt(s)) ];
    if (Object.keys(geekNameIds).length === 1) {
        where = "geek = ?";
        args[0] = parseInt(Object.keys(geekNameIds)[0]);
    }
    if (typeof query.year !== "undefined") {
        where += " and year = ?";
        args.push(query.year);
    }
    if (typeof query.month !== "undefined") {
        where += " and month = ?";
        args.push(query.month);
    }
    if (typeof query.date !== "undefined") {
        where += " and date = ?";
        args.push(query.date);
    }
    const filterTags = (query.filter || "").split(" ");
    const first = filterTags.indexOf("first") >= 0;
    const ymd = filterTags.indexOf("ymd") >= 0;
    if (first) where += " order by ymd asc";
    const playsSql = "select (year * 10000 + month * 100 + date) ymd, id, game, geek, quantity, year, month, date, expansion_play, baseplay from plays_normalised where " + where;
    const playsResult = await conn.query(playsSql, args);
    const expPlays = [];
    const basePlays: { [geek: string]: object[] } = {};
    const playsById = {};
    const gameIds: number[] = [];
    const firstKeys: string[] = [];
    for (const row of playsResult) {
        if (gameIds.indexOf(row.game) < 0) gameIds.push(row.game);
        if (first) {
            const firstKey = `${row.game}-${row.geek}`;
            if (firstKeys.indexOf(firstKey) >= 0) continue;
            firstKeys.push(firstKey);
        }
        if (row["expansion_play"]) {
            expPlays.push(row);
        } else {
            const pwd: object = { game: row.game, quantity: row.quantity };
            if (ymd) {
                pwd['ymd'] = row.ymd;
            } else {
                pwd['year'] = row.year;
                pwd['month'] = row.month;
                pwd['date'] = row.date;
            }
            const username = geekNameIds[row.geek];
            if (!username) {
                console.log("No user found for " + row.geek);
                continue;
            }
            if (!basePlays.hasOwnProperty(username)) basePlays[username] = [];
            basePlays[username].push(pwd);
            playsById[row.id] = pwd;
        }
    }
    for (const ep of expPlays) {
        const pwd = playsById[ep.baseplay];
        if (!pwd) {
            console.log("No base play " + ep.baseplay + " found");
            continue;
        }
        if (!pwd.expansions) pwd.expansions = [];
        pwd.expansions.push(ep.game);
    }
    const games = await doRetrieveGames(conn, gameIds);
    return { geeks: Object.values(geekNameIds), plays: basePlays as ShellBeRight, collection: [], games };
}

async function getAllPlays(conn: mysql.Connection, geek: string): Promise<GamePlays[]> {
    const playsSql = "select game, sum(quantity) q, max(expansion_play) x, min(year * 10000 + month * 100 + date) mi, max(year * 10000 + month * 100 + date) ma, count(distinct year) years, count(distinct year*100+month) months from plays_normalised where geek = ? group by game";
    const geekId = await getGeekId(conn, geek);
    const rows = await conn.query(playsSql, [geekId]);
    return rows.map(row => {
        return { game: row["game"], expansion: row["x"] > 0, plays: row["q"], firstPlay: row["mi"], lastPlay: row["ma"],
            distinctMonths: row["months"], distinctYears: row["years"]} as GamePlays;
    });
}

async function getMonthlyPlays(conn: mysql.Connection, geek: string): Promise<MonthlyPlays[]> {
    const playsSql = "select game, sum(quantity) q, year, month, max(expansion_play) x from plays_normalised where geek = ? group by game, year, month";
    const geekId = await getGeekId(conn, geek);
    const rows = await conn.query(playsSql, [geekId]);
    return rows.map(row => {
        return { game: row["game"], expansion: row["x"] > 0, quantity: row["q"], year: row["year"],
            month: row["month"]} as MonthlyPlays;
    });
}

async function getMonthlyCounts(conn: mysql.Connection, geek: string): Promise<MonthlyPlayCount[]> {
    const countSql = "select year, month, count(distinct date) dates from plays_normalised where geek = ? group by year, month";
    const geekId = await getGeekId(conn, geek);
    return (await conn.query(countSql, [geekId])).map(row => { return { year: row["year"], month: row["month"], count: row["dates"] }; });
}

async function getLastYearOfPlays(conn: mysql.Connection, geek: string): Promise<GamePlays[]> {
    const now = new Date();
    const today = now.getFullYear() * 10000 + now.getMonth() * 100 + now.getDate();
    const playsSql = "select game, sum(quantity) q, max(expansion_play) x, count(month) months from plays_normalised where geek = ? and ? - (year * 10000 + month * 100 + date) < 10000  group by game";
    const geekId = await getGeekId(conn, geek);
    const rows = await conn.query(playsSql, [geekId, today]);
    return rows.map(row => {
        return { game: row["game"], expansion: row["x"] > 0, plays: row["q"], distinctMonths: row["months"], distinctYears: 0 } as GamePlays;
    });
}

export async function gatherSystemStats(): Promise<SystemStats> {
    return await asyncReturnWithConnection(doGatherSystemStats);
}

export async function gatherGeekSummary(geek: string): Promise<GeekSummary> {
    return await asyncReturnWithConnection(async conn => await doGetGeekSummary(conn, geek));
}

export async function gatherGeekUpdates(geek: string): Promise<ToProcessElement[]> {
    return await asyncReturnWithConnection(async conn => await doGetGeekUpdates(conn, geek));
}

export async function markUrlForUpdate(url: string): Promise<ToProcessElement> {
    return await asyncReturnWithConnection(async conn => await doMarkUrlForUpdate(conn, url));
}

async function doGetGeekUpdates(conn: mysql.Connection, geek: string): Promise<ToProcessElement[]> {
    const updatesSQL = "select * from files where geek = ?";
    return await conn.query(updatesSQL, [geek]) as ToProcessElement[];
}

async function doMarkUrlForUpdate(conn: mysql.Connection, url: string): Promise<ToProcessElement> {
    const markSQL = "update files set lastUpdate = null where url = ?";
    const updatesSQL = "select * from files where url = ?";
    await conn.query(markSQL, [url]);
    const rows = await conn.query(updatesSQL, [url]) as ToProcessElement[];
    if (rows.length > 0) return rows[0];
    return undefined;
}

async function doGetGeekSummary(conn: mysql.Connection, geek: string): Promise<GeekSummary> {
    const ratedSql = "select count(*) c, avg(rating) avg from geekgames where geekId = ? and rating > 0";
    const monthsPlayedSql = "select count(*) c from months_played where geek = ?";
    const geekId = await getGeekId(conn, geek);
    const warTableRow = await getWarTableRow(geekId);
    const result = (await conn.query(ratedSql, [geekId]))[0];
    const rated = result["c"];
    const average = result["avg"];
    const monthsPlayed = (await conn.query(monthsPlayedSql, [geekId]))[0]["c"];
    if (!warTableRow) {
        return { warData: undefined, geekId, error: "No row was found in the war table for " + geek, rated, average,
            monthsPlayed } as GeekSummary;
    }
    return { warData: warTableRow, rated, average, monthsPlayed };
}

export async function updateFAQCount(views: number[]): Promise<FAQCount[]> {
    return await asyncReturnWithConnection(async conn => await doUpdateFAQCount(conn, views));
}

async function doUpdateFAQCount(conn: mysql.Connection, views: number[]): Promise<FAQCount[]> {
    const now = moment();
    const today = now.year() * 10000 + (now.month() + 1) * 100 + now.date();
    for (const v of views) {
        await doIncFAQCount(conn, v, today);
    }
    const countEverSql = "select faq_index, sum(count) c from faq_counts group by faq_index order by 1";
    const countSql = "select faq_index, sum(count) c from faq_counts where date >= ? group by faq_index order by 1";
    const everRows = await conn.query(countEverSql);
    const result = [] as FAQCount[];
    let index = 1;
    everRows.forEach(row => {
        while (index < row["faq_index"]) {
            result.push({ day: 0, week: 0, month: 0, year: 0, ever: 0 });
            index++;
        }
        result.push({ day: 0, week: 0, month: 0, year: 0, ever: row["c"] });
        index++;
    });
    const yearRows = await conn.query(countSql, [today - 10000]);
    patchFAQCount(yearRows, "year", result);
    const aMonthAgo = moment().subtract(1, "month");
    const aMonthAgoNumber = aMonthAgo.year() * 10000 + (aMonthAgo.month() + 1) * 100 + aMonthAgo.date();
    const monthRows = await conn.query(countSql, [aMonthAgoNumber]);
    patchFAQCount(monthRows, "month", result);
    const aWeekAgo = moment().subtract(1, "week");
    const aWeekAgoNumber = aWeekAgo.year() * 10000 + (aWeekAgo.month() + 1) * 100 + aWeekAgo.date();
    const weekRows = await conn.query(countSql, [aWeekAgoNumber]);
    patchFAQCount(weekRows, "week", result);
    const dayRows = await conn.query(countSql, [today]);
    patchFAQCount(dayRows, "day", result);
    return result;
}

function patchFAQCount(rows: object[], key: string, result: FAQCount[]) {
    for (const row of rows) {
        const i = row["faq_index"];
        result[i - 1][key] = row["c"];
    }
}

// this method is not perfect wrt locking but it doesn't need to be.
async function doIncFAQCount(conn: mysql.Connection, view: number, today: number) {
    const findSql = "select * from faq_counts where date = ? and faq_index = ?";
    const insertSql = "insert into faq_counts (date, faq_index) values (?,?)";
    const updateSql = "update faq_counts set count = ? where date = ? and faq_index = ?";
    const todayRows = await conn.query(findSql, [today, view]);
    let todayRow;
    if (todayRows.length === 0) {
        try {
            await conn.query(insertSql, [today, view]);
        } catch (e) {
            console.log(e);
            // assume simultaneous insert, it's not really that important
        }
        todayRow = (await conn.query(findSql, [today, view]))[0];
    } else {
        todayRow = todayRows[0];
    }
    if (todayRow) {
        const count = todayRow["count"];
        await conn.query(updateSql, [count + 1, today, view]);
    }
}

async function doGatherSystemStats(conn: mysql.Connection): Promise<SystemStats> {
    const countFileRows = "select processMethod, count(url) from files group by processMethod";
    const countWaitingFileRows = "select processMethod, count(url) from files where lastUpdate is null or (nextUpdate is not null && nextUpdate < now()) group by processMethod";
    const countUnprocessedFileRows = "select processMethod, count(url) from files where lastUpdate is null or (nextUpdate is not null && nextUpdate < now()) group by processMethod";
    const countGeekGamesOwnedByZero = "select count(*) from geekgames where geekid = 0";
    const countGGOwners = "select count(distinct(geekid)) c from geekgames";
    const userRows = await countTableRows(conn, "geeks");
    const gameRows = await countTableRows(conn, "games");
    const geekGamesRows = await countTableRows(conn, "geekgames");
    const notGames = await countTableRows(conn, "not_games");
    const mechanics = await countTableRows(conn, "mechanics");
    const categories = await countTableRows(conn, "categories");
    const gameMechanics = await countTableRows(conn, "game_mechanics");
    const gameCategories = await countTableRows(conn, "game_categories");
    const fileRows = (await conn.query(countFileRows)).map(gatherTypeCount);
    const ggForZero = await count(conn, countGeekGamesOwnedByZero, []);
    const distinctGGOwners = (await conn.query(countGGOwners, []))[0]["c"];
    const playsRows = await countTableRows(conn, "plays");
    const expansionRows = await countTableRows(conn, "expansions");
    const normalisedPlaysRows = await countTableRows(conn, "plays_normalised");
    ((await conn.query(countWaitingFileRows)) as any[]).forEach(row => patch(fileRows, "waiting", row));
    ((await conn.query(countUnprocessedFileRows)) as any[]).forEach(row => patch(fileRows, "unprocessed", row));
    return {
        userRows: userRows,
        gameRows: gameRows,
        geekGamesRows: geekGamesRows,
        fileRows: fileRows,
        notGames: notGames,
        categories: categories,
        mechanics: mechanics,
        gameCategories: gameCategories,
        gameMechanics: gameMechanics,
        ggForZero: ggForZero,
        distinctGGOwners: distinctGGOwners,
        playsRows: playsRows,
        expansionRows: expansionRows,
        normalisedPlaysRows: normalisedPlaysRows
    } as SystemStats;
}

function patch(fileRows: TypeCount[], patchKey: string, row: any) {
    const key = row["processMethod"];
    const count = row["count(url)"];
    fileRows.filter(row => row.type == key)[0][patchKey] = count;
}

function gatherTypeCount(row: any): TypeCount {
    return { type: row.processMethod, existing: row["count(url)"], unprocessed: 0, waiting: 0 } as TypeCount;
}

export async function listWarTable(): Promise<WarTableRow[]> {
    const sql = "select * from war_table order by lower(geekName) asc";
    return asyncReturnWithConnection(conn => conn.query(sql));
}

export async function getWarTableRow(geekId: number): Promise<WarTableRow> {
    const sql = "select * from war_table where geek = ?";
    return asyncReturnWithConnection(async conn => (await conn.query(sql, [geekId]))[0]);
}

export async function listUsers(): Promise<string[]> {
    const sql = "select username from geeks";
    return asyncReturnWithConnection(conn => conn.query(sql).then(data => data.map(row => row["username"])));
}

export async function loadExpansionData(conn: mysql.Connection): Promise<ExpansionData> {
    return new ExpansionData(await conn.query("select basegame, expansion from expansions"));
}

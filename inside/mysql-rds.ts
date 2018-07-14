import mysql = require('promise-mysql');
import {
    CollectionGame,
    MonthPlayed, NormalisedPlays, PlayData,
    ProcessGameResult,
    RankingTableRow,
    ToProcessElement,
    WarTableRow
} from "./interfaces";
import {count, returnWithConnection, withConnection, withConnectionAsync} from "./library";
import * as _ from "lodash";
import {inferExtraPlays, ExpansionData} from "./plays";

export function updateGame(data: ProcessGameResult): Promise<void> {
    return withConnection(conn => doUpdateGame(conn, data));
}

export function recordGameExpansions(gameId: number, expansions: number[]) {
    return withConnection(conn => doRecordGameExpansions(conn, gameId, expansions));
}

async function doRecordGameExpansions(conn: mysql.Connection, gameId: number, expansions: number[]) {
    const deleteSql = "delete from expansions where basegame = ?";
    const insertSql = "insert into expansions (basegame, expansion) values (?, ?)";
    await conn.query(deleteSql, gameId);
    for (const exp of expansions) {
        try {
            await conn.query(insertSql, [gameId, exp]);
        } catch (e) {
            // probably foreign key constraint because the expansion is not in the database
            // I see no need to put it there.
        }
    }
}

async function doEnsureCategory(conn: mysql.Connection, name: string) {
    const insertSql = "insert into categories (name) values (?)";
    // very likely already there so ignore any error
    await conn.query(insertSql, [name]).catch(err => {});
}

async function doEnsureMechanic(conn: mysql.Connection, name: string) {
    const insertSql = "insert into mechanics (name) values (?)";
    // very likely already there so ignore any error
    await conn.query(insertSql, [name]).catch(err => {});
}

async function setCategoriesForGame(conn: mysql.Connection, game: number, categories: string[]) {
    const getCatsSqlOne = "select id from categories where name = ?";
    const getCatsSqlMany = "select id from categories where name in (?)";
    const deleteAllGameCatsSql = "delete from game_categories where game = ?";
    const insertSql = "insert into game_categories (game, category) values (?,?)";
    let getCatsSql;
    let getCatsParams;
    if (categories.length === 1) {
        getCatsSql = getCatsSqlOne;
        getCatsParams = categories;
    } else if (categories.length > 1) {
        getCatsSql = getCatsSqlMany;
        getCatsParams = [categories];
    } else {
        await conn.query(deleteAllGameCatsSql, [game]);
        return;
    }
    for (const cat of categories) {
        await doEnsureCategory(conn, cat);
    }
    const catIds = (await conn.query(getCatsSql, getCatsParams)).map(row => row.id);
    await conn.query(deleteAllGameCatsSql, [game]);
    for (const id of catIds) {
        await conn.query(insertSql, [game, id]);
    }
}

async function setMechanicsForGame(conn: mysql.Connection, game: number, mechanics: string[]) {
    const getMecsSqlOne = "select id from mechanics where name = ?";
    const getMecsSqlMany = "select id from mechanics where name in (?)";
    const deleteAllGameMecsSql = "delete from game_mechanics where game = ?";
    const insertSql = "insert into game_mechanics (game, mechanic) values (?,?)";
    let getMecsSql;
    let getMecsParams;
    if (mechanics.length === 1) {
        getMecsSql = getMecsSqlOne;
        getMecsParams = mechanics;
    } else if (mechanics.length > 1) {
        getMecsSql = getMecsSqlMany;
        getMecsParams = [mechanics];
    } else {
        await conn.query(deleteAllGameMecsSql, [game]);
        return;
    }
    for (const mec of mechanics) {
        await doEnsureMechanic(conn, mec);
    }
    const mecIds = (await conn.query(getMecsSql, getMecsParams)).map(row => row.id);
    await conn.query(deleteAllGameMecsSql, [game]);
    for (const id of mecIds) {
        await conn.query(insertSql, [game, id]);
    }
}

async function doUpdateGame(conn: mysql.Connection, data: ProcessGameResult) {
    const countSql = "select count(*) from games where bggid = ?";
    const insertSql = "insert into games (bggid, name, average, rank, yearPublished, minPlayers, maxPlayers, playTime, usersRated, usersTrading, usersWishing, " +
        "averageWeight, bayesAverage, numComments, usersOwned, subdomain) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
    const updateSql = "update games set name = ?, average = ?, rank = ?, yearPublished = ?, minPlayers = ?, maxPlayers = ?, playTime = ?, usersRated = ?, usersTrading = ?, usersWishing = ?, " +
        "averageWeight = ?, bayesAverage = ?, numComments = ?, usersOwned = ?, subdomain = ? where bggid = ?";
    const c = await count(conn, countSql, [data.gameId]);
    if (c == 0) {
        await conn.query(insertSql, [data.gameId, data.name, data.average, data.rank, data.yearPublished, data.minPlayers,
            data.maxPlayers, data.playTime, data.usersRated, data.usersTrading, data.usersWishing, data.averageWeight, data.bayesAverage,
            data.numComments, data.usersOwned, data.subdomain]);
    } else {
        await conn.query(updateSql, [data.name, data.average, data.rank, data.yearPublished, data.minPlayers,
            data.maxPlayers, data.playTime, data.usersRated, data.usersTrading, data.usersWishing, data.averageWeight, data.bayesAverage,
            data.numComments, data.usersOwned, data.subdomain, data.gameId]);
    }
    await setCategoriesForGame(conn, data.gameId, data.categories);
    await setMechanicsForGame(conn, data.gameId, data.mechanics);
    await updateRankingTableStatsForGame(conn, data.gameId, data);
}

async function updateRankingTableStatsForGame(conn: mysql.Connection, game: number, data: ProcessGameResult) {
    const ratingSql = "select sum(rating), count(rating) from geekgames where game = ? and rating > 0";
    const insertSql = "insert into ranking_table (game, game_name, total_ratings, num_ratings, bgg_ranking, bgg_rating, normalised_ranking, total_plays) values (?,?,?,?,?,?,?,?)";
    const updateSql = "update ranking_table set game_name = ?, total_ratings = ?, num_ratings = ?, bgg_ranking = ?, bgg_rating = ?, normalised_ranking = ?, total_plays = ? where game = ?";
    const ratings = await conn.query(ratingSql, [game]);
    const total = ratings[0]['sum(rating)'];
    const count = ratings[0]['count(rating)'];
    const row: RankingTableRow = {
        game: game,
        game_name: data.name,
        bgg_ranking: data.rank || 1000000,
        bgg_rating: data.average || 0,
        normalised_ranking: 0, // TODO
        total_plays: 0, // TODO
        total_ratings: total || 0,
        num_ratings: count
    };
    try {
        await conn.query(insertSql, [row.game, row.game_name, row.total_ratings, row.num_ratings, row.bgg_ranking, row.bgg_rating, row.normalised_ranking, row.total_plays]);
    } catch (e) {
        await conn.query(updateSql, [row.game_name, row.total_ratings, row.num_ratings, row.bgg_ranking, row.bgg_rating, row.normalised_ranking, row.total_plays, row.game]);
    }
}

export function updateUserValues(geek: string, bggid: number, country: string): Promise<void> {
    const sql = "update geeks set country = ?, bggid = ? where username = ?";
    return withConnection(conn => conn.query(sql, [country, bggid, geek]));
}

export async function restrictCollectionToGames(geek: string, items: number[]) {
    const deleteStatementSome = "delete from geekgames where geek = ? and game not in (?)";
    const deleteStatementOne = "delete from geekgames where geek = ? and game != ?";
    const deleteStatementNone = "delete from geekgames where geek = ?";
    let deleteStatement;
    let params;
    if (items.length === 0) {
        deleteStatement = deleteStatementNone;
        params = [geek];
    } else if (items.length == 1) {
        deleteStatement = deleteStatementOne;
        params = [geek, items[0]];
    } else {
        deleteStatement = deleteStatementSome;
        params = [geek, items];
    }
    await withConnectionAsync(async conn => await conn.query(deleteStatement, params));
}

// longest possible MySQL time is 838:59:59 hours: http://dev.mysql.com/doc/refman/5.5/en/date-and-time-type-overview.html
const TILL_NEXT_UPDATE = { 'processCollection' : '72:00:00', 'processMarket' : '72:00:00', 'processPlayed' : '72:00:00',
    'processGame' : '838:00:00', 'processTop50' : '72:00:00', "processFrontPage" : '24:00:00', "processUser": '838:00:00'  };


export async function markUrlProcessed(processMethod: string, url: string) {
    const delta = TILL_NEXT_UPDATE[processMethod];
    const sqlSet = "update files set lastUpdate = now(), nextUpdate = addtime(now(), ?) where url = ? and processMethod = ?";
    await withConnectionAsync(async conn => await conn.query(sqlSet, [delta, url, processMethod]));
}

export async function markUrlUnprocessed(processMethod: string, url: string) {
    const sqlSet = "update files set last_scheduled = null where url = ? and processMethod = ?";
    await withConnectionAsync(async conn => await conn.query(sqlSet, [url, processMethod]));
}

export async function markUrlTryTomorrow(processMethod: string, url: string) {
    const sqlSet = "update files set last_scheduled = addtime(now(), '24:00:00') where url = ? and processMethod = ?";
    await withConnectionAsync(async conn => await conn.query(sqlSet, [url, processMethod]));
}

export async function markGameDoesNotExist(bggid: number) {
    return withConnection(conn => doMarkGameDoesNotExist(conn, bggid));
}

async function doMarkGameDoesNotExist(conn: mysql.Connection, bggid: number) {
    const insertSql = "insert into not_games (bggid) values (?)";
    const deleteSql1 = "delete from files where processMethod = 'processGame' and bggid = ?";
    const deleteSql2 = "delete from geekgames where game = ?";
    try {
        await conn.query(insertSql, [bggid]);
    } catch (e) {
        // ignore error if it's already there
    }
    await conn.query(deleteSql1, [bggid]);
    await conn.query(deleteSql2, [bggid]);
}

export function ensureUsers(users: string[]): Promise<void> {
    const uniques: string[] = [];
    for (let i=0; i<users.length; i++) {
        if (uniques.indexOf(users[i]) >= 0) {
            console.log("User " + users[i] + " is duplicated in the users list.");
        } else {
            uniques.push(users[i]);
        }
    }
    return withConnection(conn => doEnsureExactlyUsers(conn, uniques))
        .then(() => console.log("All users processed."));
}

function doEnsureExactlyUsers(conn: mysql.Connection, users: string[]): Promise<void> {
    let extraUsers;
    const extraSql = "select username from geeks where username not in (?)";
    return conn.query(extraSql, [users])
        .then(xus => {
            extraUsers = xus.map(it => it.username);
        })
        .then(() => doEnsureUsers(conn, users))
        .then(() => deleteExtraUsers(conn, extraUsers));
}

function deleteExtraUsers(conn: mysql.Connection, extraUsers: string[]): Promise<void> {
    console.log("Deleting " + extraUsers.length + " unwanted users.");
    const deleteOneFile = "delete from files where geek = ?";
    const deleteOneGeek = "delete from geeks where username = ?";
    const deleteSomeFiles = "delete from files where geek in (?)";
    const deleteSomeGeeks = "delete from geeks where username in (?)";
    if (extraUsers.length === 0) {
        return Promise.resolve();
    } else if (extraUsers.length === 1) {
        return conn.query(deleteOneFile, extraUsers)
            .then(() => conn.query(deleteOneGeek, extraUsers));
    } else {
        return conn.query(deleteSomeFiles, [extraUsers])
            .then(() => conn.query(deleteSomeGeeks, [extraUsers]));
    }
}

async function doEnsureUser(conn: mysql.Connection, user: string) {
    const insertSql = "insert into geeks (username) values (?)";
    try {
        await conn.query(insertSql, [user]);
        console.log("added user " + user);
    } catch (e) {
        // user already there
    }
    const geekid = await getGeekId(conn, user);
    await doEnsureFileProcessUser(conn, user, geekid);
    await doEnsureFileProcessUserCollection(conn, user, geekid);
    await doEnsureFileProcessUserPlayed(conn, user, geekid);
}

async function doEnsureUsers(conn: mysql.Connection, users: string[]) {
    for (const user of users) {
        await doEnsureUser(conn, user);
    }
}

export async function updateGamesForGeek(geek: string, games: CollectionGame[]) {
    return withConnection(conn => doUpdateGamesForGeek(conn, geek, games));
}

async function doUpdateGamesForGeek(conn: mysql.Connection, geek: string, games: CollectionGame[]) {
    const geekId = await getGeekId(conn, geek);
    const notExist = await getGamesThatDontExist(conn);
    for (const game of games) {
        if (notExist.indexOf(game.gameId) >= 0) continue;
        await insertOrUpdateGeekgame(conn, geek, geekId, game);
    }
}

async function insertOrUpdateGeekgame(conn: mysql.Connection, geek: string, geekId: number, game: CollectionGame) {
    const insertSql = "insert into geekgames (geek, geekId, game, rating, owned, want, wish, trade, prevowned, wanttobuy, wanttoplay, preordered) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    // TODO when no geekIds are zero, change this
    const updateSql = "update geekgames set geekId = ?, rating = ?, owned = ?, want = ?, wish = ?, trade = ?, prevowned = ?, wanttobuy = ?, wanttoplay = ?, preordered = ? where geek = ? and game = ?";
    try {
        await conn.query(insertSql, [geek, game.gameId, game.rating, game.owned, game.want, game.wishListPriority,
            game.forTrade, game.prevOwned, game.wantToBuy, game.wantToPlay, game.preordered]);
        console.log("Added game " + game.gameId + " for " + geek);
    } catch (e) {
        await conn.query(updateSql, [geekId, game.rating, game.owned, game.want, game.wishListPriority, game.forTrade,
            game.prevOwned, game.wantToBuy, game.wantToPlay, game.preordered, geek, game.gameId]);
    }
}

export async function ensureProcessPlaysFiles(geek: string, months: MonthPlayed[]) {
    await withConnection(conn => doEnsureProcessPlaysFiles(conn, geek, months));
}

async function doEnsureProcessPlaysFiles(conn: mysql.Connection, geek: string, months: MonthPlayed[]) {
    const playsUrl = "https://boardgamegeek.com/xmlapi2/plays?username=%s&mindate=%d-%d-01&maxdate=%d-%d-31&subtype=boardgame".replace("%s", encodeURIComponent(geek));
    const timelessPlaysUrl = "https://boardgamegeek.com/xmlapi2/plays?username=%s&mindate=0000-00-00&maxdate=0000-00-00&subtype=boardgame".replace("%s", encodeURIComponent(geek));
    const geekId = await getGeekId(conn, geek);
    for (const month of months) {
        let url = playsUrl
            .replace("%d", month.year.toString())
            .replace("%d", month.month.toString())
            .replace("%d", month.year.toString())
            .replace("%d", month.month.toString());
        if (month.month === 0 && month.year === 0) url = timelessPlaysUrl;
        await doRecordFile(conn, url, "processPlays", geek, "Plays for " + geek + " for " + month.month + "/" + month.year,
            null, month.month, month.year, geekId);
    }
}

export async function ensureMonthsPlayed(geek: string, months: MonthPlayed[]) {
    await withConnection(conn => doEnsureMonthsPlayed(conn, geek, months));
}

async function doEnsureMonthsPlayed(conn: mysql.Connection, geek: string, months: MonthPlayed[]) {
    const geekId = await getGeekId(conn, geek);
    const insertSql = "insert into months_played (geek, month, year) values (?, ?, ?)";
    for (const month of months) {
        try {
            await conn.query(insertSql, [geekId, month.month, month.year]);
        } catch (e) {
            // ignore insert duplicate row
        }
    }
}

export async function ensureGames(games: CollectionGame[]) {
    await withConnection(conn => doEnsureGames(conn, games.map(cg => cg.gameId)));
}

async function doEnsureGames(conn: mysql.Connection, ids: number[]) {
    if (ids.length === 0) return;
    const sqlSome = "select bggid from files where bggid in (?) and processMethod = 'processGame'";
    const sqlOne = "select bggid from files where bggid = ? and processMethod = 'processGame'";
    let params;
    let sql;
    if (ids.length == 1) {
        sql = sqlOne;
        params = ids;
    } else {
        sql = sqlSome;
        params = [ids];
    }
    const found = (await conn.query(sql, params)).map(row => row.bggid);
    const notExist = await getGamesThatDontExist(conn);
    for (const id of listMinus(listMinus(ids, found), notExist)) {
        await doRecordGame(conn, id);
    }
}

function listMinus(ints: number[], takeaway: number[]): number[] {
    return ints.filter(x => takeaway.indexOf(x) < 0);
}

function doRecordGame(conn: mysql.Connection, bggid: number): Promise<void> {
    const GAME_URL = "https://boardgamegeek.com/xmlapi/boardgame/%d&stats=1";
    const url = GAME_URL.replace("%d", bggid.toString());
    const insertSql = "insert into files (url, processMethod, geek, lastupdate, tillNextUpdate, description, bggid) values (?, ?, ?, ?, ?, ?, ?)";
    const tillNext = TILL_NEXT_UPDATE["processGame"];
    const insertParams = [url, "processGame", null, null, tillNext, "Game #" + bggid, bggid];
    return conn.query(insertSql, insertParams).catch(err => {});
}


function doRecordFile(conn: mysql.Connection, url: string, processMethod: string, user: string | null, description: string,
                      bggid: number | null, month: number | null, year: number | null, geekid: number | null): Promise<void> {
    const countSql = "select count(*) from files where url = ? and processMethod = ?";
    const insertSql = "insert into files (url, processMethod, geek, lastupdate, tillNextUpdate, description, bggid, month, year, geekid) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    return count(conn, countSql, [url, processMethod])
        .then(count => {
            if (count === 0) {
                const tillNext = TILL_NEXT_UPDATE[processMethod];
                const insertParams = [url, processMethod, user, null, tillNext, description, bggid, month, year, geekid];
                return conn.query(insertSql, insertParams).catch(err => {});
            }
        });
}

function doEnsureFileProcessUser(conn: mysql.Connection, geek: string, geekid: number): Promise<void> {
    const url = `https://boardgamegeek.com/user/${geek}`;
    return doRecordFile(conn, url, "processUser", geek, "User's profile", null, null, null, geekid);
}

function doEnsureFileProcessUserCollection(conn: mysql.Connection, geek: string, geekid: number): Promise<void> {
    const url = `https://boardgamegeek.com/xmlapi2/collection?username=${geek}&brief=1&stats=1`;
    return doRecordFile(conn, url, "processCollection", geek, "User collection - owned, ratings, etc", null, null, null, geekid);
}

function doEnsureFileProcessUserPlayed(conn: mysql.Connection, geek: string, geekid: number): Promise<void> {
    const url = `https://boardgamegeek.com/plays/bymonth/user/${geek}/subtype/boardgame`;
    return doRecordFile(conn, url, "processPlayed", geek, "Months in which user has played games", null, null, null, geekid);
}

export function listToProcess(count: number): Promise<ToProcessElement[]> {
    const sql = "select * from files where (lastUpdate is null || nextUpdate is null || nextUpdate < now()) and (processMethod != 'processPlays') and (last_scheduled is null || TIMESTAMPDIFF(MINUTE, last_scheduled, now()) >= 10) limit ?";
    return returnWithConnection(conn => conn.query(sql, [count]).map(row => row as ToProcessElement));
}

export function listToProcessByMethod(count: number, processMethod: string): Promise<ToProcessElement[]> {
    const sql = "select * from files where processMethod = ? and (lastUpdate is null || nextUpdate < now()) and (last_scheduled is null || TIMESTAMPDIFF(MINUTE, last_scheduled, now()) >= 15) limit ?";
    return returnWithConnection(conn => conn.query(sql, [processMethod, count]).map(row => row as ToProcessElement));
}

export function updateLastScheduledForUrls(urls: string[]): Promise<void> {
    return withConnection(conn => doUpdateLastScheduledForUrls(conn, urls));
}

async function doUpdateLastScheduledForUrls(conn: mysql.Connection, urls: string[]) {
    const sqlOne = "update files set last_scheduled = now() where url = ?";
    const sqlMany = "update files set last_scheduled = now() where url in (?)";
    if (urls.length == 0) {
        return;
    } else if (urls.length == 1) {
        await conn.query(sqlOne, urls);
    } else {
        await conn.query(sqlMany, [urls]);
    }
}

export async function updateFrontPageGeek(geekName: string) {
    await withConnectionAsync(async conn => await doUpdateFrontPageGeek(conn, geekName));
}

async function doUpdateFrontPageGeek(conn: mysql.Connection, geekName: string) {
    const geekId = await getGeekId(conn, geekName);
    const owned = await countWhere(conn, "geekgames where geekId = ? and owned > 0", [geekId]);
    const want = await countWhere(conn, "geekgames where geekId = ? and want > 0", [geekId]);
    const wish = await countWhere(conn, "geekgames where geekId = ? and wish > 0", [geekId]);
    const forTrade = await countWhere(conn, "geekgames where geekId = ? and trade > 0", [geekId]);
    const prevOwned = await countWhere(conn, "geekgames where geekId = ? and prevowned > 0", [geekId]);
    const preordered = await countWhere(conn, "geekgames where geekId = ? and preordered > 0", [geekId]);
    const fpg: WarTableRow = {
        geek: geekId,
        geekName: geekName,
        total_plays: 0, // TODO
        distinct_games: 0, // TODO
        top50: 0, // TODO
        sdj: 0, // TODO
        owned: owned,
        want: want,
        wish: wish,
        forTrade: forTrade,
        prevOwned: prevOwned,
        friendless: 0, // TODO
        cfm: 0.0, // TODO
        utilisation: 0.0, // TODO
        tens: 0, //TODO
        zeros: 0, // TODO
        mostVoters: 0, // TODO
        top100: 0, // TODO
        hindex: 0, // TODO
        preordered: preordered
    };
    const insertSql = "insert into war_table (geek, geekName, totalPlays, distinctGames, top50, sdj, owned, want, wish, " +
        "trade, prevOwned, friendless, cfm, utilisation, tens, zeros, mv, ext100, hindex, preordered) values " +
        "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
    const updateSql = "update war_table set geekName = ?, totalPlays = ?, distinctGames = ?, top50 = ?, sdj = ?, owned = ?, "
        + "want = ?, wish = ?, trade = ?, prevOwned = ?, friendless = ?, cfm = ?, utilisation = ?, tens = ?, zeros = ?, mv = ?, "
        + "ext100 = ?, hindex = ?, preordered = ? where geek = ?";
    try {
        await conn.query(insertSql, [fpg.geek, fpg.geekName, fpg.total_plays, fpg.distinct_games, fpg.top50, fpg.sdj, fpg.owned,
            fpg.want, fpg.wish, fpg.forTrade, fpg.prevOwned, fpg.friendless, fpg.cfm, fpg.utilisation, fpg.tens, fpg.zeros, fpg.mostVoters,
            fpg.top100, fpg.hindex, fpg.preordered]);
    } catch (e) {
        await conn.query(updateSql, [fpg.geekName, fpg.total_plays, fpg.distinct_games, fpg.top50, fpg.sdj, fpg.owned,
            fpg.want, fpg.wish, fpg.forTrade, fpg.prevOwned, fpg.friendless, fpg.cfm, fpg.utilisation, fpg.tens, fpg.zeros, fpg.mostVoters,
            fpg.top100, fpg.hindex, fpg.preordered, fpg.geek]);
    }
}

export async function ensurePlaysGames(gameIds: number[]) {
    await withConnection(conn => doEnsureGames(conn, gameIds));
}

function playDate(play: NormalisedPlays): number {
    return play.year * 10000 + play.month * 100 + play.date;
}

export async function doNormalisePlaysForMonth(conn: mysql.Connection, geekId: number, month: number, year: number, expansionData: ExpansionData) {
    console.log("normalising plays for " + geekId + " " + month + " " + year);
    const selectSql = "select game, playDate, quantity from plays where geek = ? and month = ? and year = ?";
    const rows = await conn.query(selectSql, [geekId, month, year]);
    const rawData = rows.map(row => extractNormalisedPlayFromPlayRow(row, geekId, month, year));
    console.log(rawData);
    const byDate = _.groupBy(rawData, playDate);
    const allPlays = _.flatMap(Object.values(byDate).map(plays => inferExtraPlays(plays, expansionData)));
    console.log(allPlays);
}

function extractNormalisedPlayFromPlayRow(row: object, geek: number, month: number, year: number): NormalisedPlays {
    const playDate = row["playDate"].toString();
    const date = parseInt(playDate.split(" ")[2]);
    return { month, year, geek, date, game: row["game"], quantity: row["quantity"] } as NormalisedPlays;
}

export async function doSetGeekPlaysForMonth(conn: mysql.Connection, geekId: number, month: number, year: number, plays: PlayData[]) {
    const deleteSql = "delete from plays where geek = ? and month = ? and year = ?";
    const insertSql = "insert into plays (game, geek, playDate, quantity, raters, ratingsTotal, location, month, year) values (?, ?, STR_TO_DATE(?, '%Y-%m-%d'), ?, ?, ?, ?, ?, ?)";
    const playsAlready = await countWhere(conn, "plays where geek = ? and month = ? and year = ?", [geekId, month, year]);
    if (playsAlready > 0 && plays.length === 0) {
        console.log("Not updating plays for " + geekId + " " + month + "/" + year + " because there are existing plays and none to replace them.");
        return;
    }
    await conn.query(deleteSql, [geekId, month, year]);
    for (const play of plays) {
        await conn.query(insertSql, [play.gameid, geekId, play.date, play.quantity, play.raters, play.ratingsTotal, play.location, month, year]);
    }
}

export async function getGeekId(conn: mysql.Connection, geek: string): Promise<number> {
    const getIdSql = "select id from geeks where geeks.username = ?";
    return (await conn.query(getIdSql, [geek]))[0]['id'];
}

async function countWhere(conn: mysql.Connection, where: string, params: any[]) {
    const sql = "select count(*) from " + where;
    const result = await conn.query(sql, params);
    return result[0]["count(*)"];
}

async function getGamesThatDontExist(conn: mysql.Connection): Promise<number[]> {
    const sql = "select bggid from not_games";
    return (await conn.query(sql)).map(row => row.bggid);
}

export async function loadExpansionData(conn: mysql.Connection): Promise<ExpansionData> {
    return new ExpansionData(await conn.query("select basegame, expansion from expansions"));
}
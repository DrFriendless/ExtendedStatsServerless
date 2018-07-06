import mysql = require('promise-mysql');
import {CollectionGame, ProcessGameResult, RankingTableRow, ToProcessElement, WarTableRow} from "./interfaces";
import {count, getConnection, returnWithConnection, withConnection, withConnectionAsync} from "./library";

export function updateGame(data: ProcessGameResult): Promise<void> {
    console.log("updateGame");
    console.log(data);
    return withConnection(conn => doUpdateGame(conn, data));
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
    console.log("updateUserValues " + geek + " " + bggid + " " + country);
    const sql = "update geeks set country = ?, bggid = ? where username = ?";
    return withConnection(conn => conn.query(sql, [country, bggid, geek]));
}

export async function restrictCollectionToGames(geek: string, items: number[]) {
    console.log("restrictCollectionToGames " + geek);
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
    console.log(deleteStatement);
    console.log(params);
    await withConnectionAsync(async conn => await conn.query(deleteStatement, params));
}

// longest possible MySQL time is 838:59:59 hours: http://dev.mysql.com/doc/refman/5.5/en/date-and-time-type-overview.html
const TILL_NEXT_UPDATE = { 'processCollection' : '72:00:00', 'processMarket' : '72:00:00', 'processPlayed' : '72:00:00',
    'processGame' : '838:00:00', 'processTop50' : '72:00:00', "processFrontPage" : '24:00:00', "processUser": '838:00:00'  };


export async function markUrlProcessed(processMethod: string, url: string) {
    console.log("markUrlProcessed " + url);
    const delta = TILL_NEXT_UPDATE[processMethod];
    const sqlSet = "update files set lastUpdate = now(), nextUpdate = addtime(now(), ?) where url = ? and processMethod = ?";
    await withConnectionAsync(async conn => await conn.query(sqlSet, [delta, url, processMethod]));
}

export async function markUrlUnprocessed(processMethod: string, url: string) {
    console.log("markUrlUnprocessed " + url);
    const sqlSet = "update files set last_scheduled = null where url = ? and processMethod = ?";
    await withConnectionAsync(async conn => await conn.query(sqlSet, [url, processMethod]));
}

export function markGameDoesNotExist(bggid: number): Promise<void> {
    console.log("markGameDoesNotExist " + bggid);
    const sql = "insert into not_games (bggid) values (?)";
    // ignore insert error
    return withConnection(conn => conn.query(sql, [bggid]).catch(err => {}));
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

function doEnsureUser(conn: mysql.Connection, user: string): Promise<void> {
    const insertSql = "insert into geeks (username) values (?)";
    return conn.query(insertSql, [user])
        .then(() => console.log("added user " + user))
        .catch(Error, err => {})
        .then(() => doEnsureFileProcessUser(conn, user))
        .then(() => doEnsureFileProcessUserCollection(conn, user))
        .then(() => doEnsureFileProcessUserPlayed(conn, user));
}

function doEnsureUsers(conn: mysql.Connection, users: string[]): Promise<void> {
    return Promise.all(users.map(user => doEnsureUser(conn, user)));
}

export async function updateGamesForGeek(geek: string, games: CollectionGame[]) {
    return withConnection(conn => doUpdateGamesForGeek(conn, geek, games));
}

async function doUpdateGamesForGeek(conn: mysql.Connection, geek: string, games: CollectionGame[]) {
    const geekId = await getGeekId(conn, geek);
    for (const game of games) {
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

export async function ensureGames(games: CollectionGame[]) {
    await withConnection(conn => doEnsureGames(conn, games));
}

async function doEnsureGames(conn: mysql.Connection, games: CollectionGame[]) {
    if (games.length === 0) return;
    const ids = games.map(cg => cg.gameId);
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
    for (const id of listMinus(ids, found)) {
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

    return conn.query(insertSql, insertParams)
        .then(() => console.log("added url " + url))
        .catch(err => console.log(err));
}


function doRecordFile(conn: mysql.Connection, url: string, processMethod: string, user: string | null, description: string, bggid: number | null): Promise<void> {
    const countSql = "select count(*) from files where url = ? and processMethod = ?";
    const insertSql = "insert into files (url, processMethod, geek, lastupdate, tillNextUpdate, description, bggid) values (?, ?, ?, ?, ?, ?, ?)";
    return count(conn, countSql, [url, processMethod])
        .then(count => {
            if (count === 0) {
                const tillNext = TILL_NEXT_UPDATE[processMethod];
                const insertParams = [url, processMethod, user, null, tillNext, description, bggid];
                return conn.query(insertSql, insertParams)
                    .then(() => console.log("added url " + url))
                    .catch(err => console.log(err));
            }
        });
}

function doEnsureFileProcessUser(conn: mysql.Connection, geek: string): Promise<void> {
    const url = `https://boardgamegeek.com/user/${geek}`;
    return doRecordFile(conn, url, "processUser", geek, "User's profile", null);
}

function doEnsureFileProcessUserCollection(conn: mysql.Connection, geek: string): Promise<void> {
    const url = `https://boardgamegeek.com/xmlapi2/collection?username=${geek}&brief=1&stats=1`;
    return doRecordFile(conn, url, "processCollection", geek, "User collection - owned, ratings, etc", null);
}

function doEnsureFileProcessUserPlayed(conn: mysql.Connection, geek: string): Promise<void> {
    const url = `https://boardgamegeek.com/plays/bymonth/user/${geek}/subtype/boardgame`;
    return doRecordFile(conn, url, "processPlayed", geek, "Months in which user has played games", null);
}

export function listToProcess(count: number): Promise<ToProcessElement[]> {
    const sql = "select * from files where (lastUpdate is null || nextUpdate is null || nextUpdate < now()) and processMethod != 'processPlayed' and (last_scheduled is null || TIMESTAMPDIFF(MINUTE, last_scheduled, now()) >= 10) limit ?";
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
    console.log("doUpdateFrontPageGeek " + geekName);
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
    console.log(fpg);
    const insertSql = "insert into war_table (geek, geekName, totalPlays, distinctGames, top50, sdj, owned, want, wish, " +
        "trade, prevOwned, friendless, cfm, utilisation, tens, zeros, mv, ext100, hindex, preordered) values " +
        "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
    const updateSql = "update war_table set geekName = ?, totalPlays = ?, distinctGames = ?, top50 = ?, sdj = ?, owned = ?, "
    + "want = ?, wish = ?, trade = ?, prevOwned = ?, friendless = ?, cfm = ?, utilisation = ?, tens = ?, zeros = ?, mv = ?, "
    + "ext100 = ?, hindex = ?, preordered = ? where geek = ?";
    try {
        console.log("insert");
        await conn.query(insertSql, [fpg.geek, fpg.geekName, fpg.total_plays, fpg.distinct_games, fpg.top50, fpg.sdj, fpg.owned,
        fpg.want, fpg.wish, fpg.forTrade, fpg.prevOwned, fpg.friendless, fpg.cfm, fpg.utilisation, fpg.tens, fpg.zeros, fpg.mostVoters,
        fpg.top100, fpg.hindex, fpg.preordered]);
    } catch (e) {
        console.log("update");
        console.log(e);
        await conn.query(updateSql, [fpg.geekName, fpg.total_plays, fpg.distinct_games, fpg.top50, fpg.sdj, fpg.owned,
            fpg.want, fpg.wish, fpg.forTrade, fpg.prevOwned, fpg.friendless, fpg.cfm, fpg.utilisation, fpg.tens, fpg.zeros, fpg.mostVoters,
            fpg.top100, fpg.hindex, fpg.preordered, fpg.geek]);
    }
}

async function getGeekId(conn: mysql.Connection, geek: string): Promise<number> {
    const getIdSql = "select id from geeks where geeks.username = ?";
    return (await conn.query(getIdSql, [geek]))[0]['id'];
}

async function countWhere(conn: mysql.Connection, where: string, params: any[]) {
    const sql = "select count(*) from " + where;
    const result = await conn.query(sql, params);
    return result[0]["count(*)"];
}
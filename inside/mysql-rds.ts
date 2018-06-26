import mysql = require('promise-mysql');
import {CollectionGame, ProcessGameResult, ToProcessElement} from "./interfaces";

export function updateGame(data: ProcessGameResult): Promise<void> {
    console.log("updateGame");
    console.log(data);
    let connection;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => doUpdateGame(conn, data))
        .then(() => connection.destroy());
}

function withConnection(func: (conn: mysql.Connection) => Promise<void>): Promise<void> {
    let connection;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => func(conn))
        .then(() => connection.destroy())
        .catch(err => {
            connection.destroy();
            throw err;
        });
}

function doUpdateGame(conn: mysql.Connection, data: ProcessGameResult): Promise<void> {
    const countSql = "select count(*) from games where bggid = ?";
    const insertSql = "insert into games (bggid, name, average, rank, yearPublished, minPlayers, maxPlayers, playTime, usersRated, usersTrading, usersWishing, " +
        "averageWeight, bayesAverage, numComments, usersOwned, subdomain) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
    const updateSql = "updates games set (name, average, rank, yearPublished, minPlayers, maxPlayers, playTime, usersRated, usersTrading, usersWishing, " +
        "averageWeight, bayesAverage, numComments, usersOwned, subdomain) = (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) where bggid = ?";
    return count(conn, countSql, [data.gameId])
        .then(count => {
            if (count == 0) {
                return conn.query(insertSql, [data.gameId, data.name, data.average, data.rank, data.yearPublished, data.minPlayers,
                    data.maxPlayers, data.playTime, data.usersRated, data.usersTrading, data.usersWishing, data.averageWeight, data.bayesAverage,
                    data.numComments, data.usersOwned, data.subdomain]);
            } else {
                return conn.query(updateSql, [data.name, data.average, data.rank, data.yearPublished, data.minPlayers,
                    data.maxPlayers, data.playTime, data.usersRated, data.usersTrading, data.usersWishing, data.averageWeight, data.bayesAverage,
                    data.numComments, data.usersOwned, data.subdomain, data.gameId]);
            }
        });
}


export function updateUserValues(geek: string, bggid: number, country: string): Promise<void> {
    console.log("updateUserValues " + geek + " " + bggid + " " + country);
    const sql = "update geeks set country = ?, bggid = ? where username = ?";
    let connection;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => conn.query(sql, [country, bggid, geek]))
        .then(() => connection.destroy());
}

export function restrictCollectionToGames(geek: string, items: [number]): Promise<void> {
    console.log("restrictCollectionToGames " + geek);
    const deleteStatementSome = "delete from geekgames where geek = ? and game not in (?)";
    const deleteStatementOne = "delete from geekgames where geek = ? and game != ?";
    const deleteStatementNone = "delete from geekgames where geek = ?";
    let deleteStatement;
    let params;
    if (items.length == 0) {
        deleteStatement = deleteStatementNone;
        params = [geek];
    } else if (items.length == 1) {
        deleteStatement = deleteStatementOne;
        params = [geek, items[0]];
    } else {
        deleteStatement = deleteStatementSome;
        params = [geek, items];
    }
    let connection;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => conn.query(deleteStatement, params))
        .then(() => connection.destroy());
}

// longest possible MySQL time is 838:59:59 hours: http://dev.mysql.com/doc/refman/5.5/en/date-and-time-type-overview.html
const TILL_NEXT_UPDATE = { 'processCollection' : '72:00:00', 'processMarket' : '72:00:00', 'processPlayed' : '72:00:00',
    'processGame' : '838:00:00', 'processTop50' : '72:00:00', "processFrontPage" : '24:00:00', "processUser": '838:00:00'  };


export function markUrlProcessed(processMethod: string, url: string): Promise<void> {
    console.log("markUrlProcessed " + url);
    const delta = TILL_NEXT_UPDATE[processMethod];
    const sqlSet = "update files set lastUpdate = now(), nextUpdate = addtime(now(), ?) where url = ? and processMethod = ?";
    return withConnection(conn => conn.query(sqlSet, [delta, url, processMethod]))
}

export function markUrlUnprocessed(processMethod: string, url: string): Promise<void> {
    console.log("markUrlUnprocessed " + url);
    const sqlSet = "update files set last_scheduled = null where url = ? and processMethod = ?";
    return withConnection(conn => conn.query(sqlSet, [url, processMethod]));
}

export function ensureUsers(users: string[]): Promise<void[]> {
    return withConnection(conn => doEnsureUsers(conn, users));
}

function doEnsureUsers(conn: mysql.Connection, users: string[]): Promise<void> {
    const countSql = "select username, count(*) from geeks where username = ?";
    const insertSql = "insert into geeks (username) values (?)";
    for (let i=0; i<users.length; i++) {
        if (users.indexOf(users[i]) != i) console.log("User " + users[i] + " is duplicated in the users list.");
    }
    return Promise.all(users.map(user => {
        conn.query(countSql, [user])
            .then(result => {
                console.log("" + user + " " + result);
                return result[0]["count(*)"];
            })
            .then(count => {
                if (count == 0) {
                    return conn.query(insertSql, [user]).then(() => console.log("added user " + user));
                } else {
                    return Promise.resolve();
                }
            })
            .then(() => Promise.all(
                doEnsureFileProcessUser(conn, user),
                doEnsureFileProcessUserCollection(conn, user),
                doEnsureFileProcessUserPlayed(conn, user)
            ))
            .catch(err => console.log(err));
    }));
}

export function updateGamesForGeek(geek: string, games: [CollectionGame]): Promise<void> {
    return withConnection(conn => doUpdateGamesForGeek(conn, geek, games));
}

function doUpdateGamesForGeek(conn: mysql.Connection, geek: string, games: [CollectionGame]): Promise<void> {
    const countSql = "select count(*) from geekgames where geek = ? and game = ?";
    const insertSql = "insert into geekgames (geek, game, rating, owned, want, wish, trade, prevowned, wanttobuy, wanttoplay, preordered) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const updateSql = "update geekgames set (rating, owned, want, wish, trade, prevowned, wanttobuy, wanttoplay, preordered) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) where geek = ? and game = ?";
    return Promise.all(games.map(game => {
        return count(conn, countSql, [geek, game.gameId])
            .then(count => {
                if (count > 0) {
                    return conn.query(updateSql, [game.rating, game.owned, game.want, game.wishListPriority, game.forTrade,
                        game.prevOwned, game.wantToBuy, game.wantToPlay, game.preordered, geek, game.gameId]);
                } else {
                    return conn.query(insertSql, [geek, game.gameId, game.rating, game.owned, game.want, game.wishListPriority,
                        game.forTrade, game.prevOwned, game.wantToBuy, game.wantToPlay, game.preordered]);
                }
            });
    }));
}

export function ensureGames(games: [CollectionGame]): Promise<void> {
    return withConnection(conn => doEnsureGames(conn, games));
}

function doEnsureGames(conn: mysql.Connection, games: [CollectionGame]): Promise<void> {
    if (games.length == 0) return Promise.resolve();
    const ids = games.map(cg => parseInt(cg.gameId));

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
    return conn.query(sql, params)
        .then(result => result.map(row => row.bggid))
        .then((found: number[]) => listMinus(ids, found))
        .then(todo => Promise.all(todo.map(id => {
            return doRecordGame(conn, id);
        })));
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

export function listToProcess(count: number): Promise<[ToProcessElement]> {
    const sql = "select * from files where (lastUpdate is null || nextUpdate is null || nextUpdate < now()) and (last_scheduled is null || TIMESTAMPDIFF(MINUTE, last_scheduled, now()) >= 10) limit ?";
    let connection;
    let result: [ToProcessElement];
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => conn.query(sql, [count]))
        .then(data => {
            result = data.map(row => row as ToProcessElement)
        })
        .then(() => connection.destroy())
        .then(() => result);
}

export function listToProcessByMethod(count: number, processMethod: string): Promise<[ToProcessElement]> {
    const sql = "select * from files where processMethod = ? and (lastUpdate is null || nextUpdate < now()) and (last_scheduled is null || TIMESTAMPDIFF(MINUTE, last_scheduled, now()) >= 10) limit ?";
    let connection;
    let result: [ToProcessElement];
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => conn.query(sql, [processMethod, count]))
        .then(data => {
            result = data.map(row => row as ToProcessElement);
        })
        .then(() => connection.destroy())
        .then(() => result);
}

export function updateLastScheduledForUrls(urls: string[]): Promise<void> {
    const sqlOne = "update files set last_scheduled = now() where url = ?";
    const sqlMany = "update files set last_scheduled = now() where url in (?)";
    let connection: mysql.Connection;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => {
            if (urls.length == 0) {
                return Promise.resolve(undefined);
            } else if (urls.length == 1) {
                return conn.query(sqlOne, urls);
            } else {
                return conn.query(sqlMany, [urls]);
            }
        })
        .then(() => connection.destroy());
}

function getConnection(): Promise<mysql.Connection> {
    const params = {
        host: process.env.mysqlHost,
        user: process.env.mysqlUsername,
        password: process.env.mysqlPassword,
        database: process.env.mysqlDatabase
    };
    return mysql.createConnection(params);
}

function count(conn: mysql.Connection, sql: string, params: [any]): Promise<number> {
    return conn.query(sql, params).then(result => result[0]["count(*)"]);
}


import mysql = require('promise-mysql');
import {CollectionGame, ToProcessElement} from "./interfaces";

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

// longest possible MySQL time is 838:59:59 hours: http://dev.mysql.com/doc/refman/5.5/en/date-and-time-type-overview.html
const TILL_NEXT_UPDATE = { 'processCollection' : '72:00:00', 'processMarket' : '72:00:00', 'processPlayed' : '72:00:00',
    'processGame' : '838:00:00', 'processTop50' : '72:00:00', "processFrontPage" : '24:00:00', "processUser": '838:00:00'  };


export function markUrlProcessed(processMethod: string, url: string): Promise<void> {
    console.log("markUrlProcessed " + url);
    const delta = TILL_NEXT_UPDATE[processMethod];
    const sqlSet = "update files set lastUpdate = now(), nextUpdate = addtime(now(), ?) where url = ?";
    let connection;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => conn.query(sqlSet, [delta, url]))
        .then(() => connection.destroy());
}

export function ensureUsers(users: string[]): Promise<void[]> {
    let connection;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => doEnsureUsers(conn, users))
        .then(() => connection.destroy());
}

function doEnsureUsers(conn: mysql.Connection, users: string[]): Promise<void[]> {
    const countSql = "select username, count(*) from geeks where username = ?";
    const insertSql = "insert into geeks (username) values (?)";
    for (let i=0; i<users.length; i++) {
        if (users.indexOf(users[i]) != i) console.log("User " + users[i] + " is duplicated in the users list.");
    }
    return Promise.all(users.map(user => {
        conn.query(countSql, [user])
            .then(result => {
                return { count: result[0]["count(*)"], user: result[0]["username"] }
            })
            .then(uc => {
                if (uc.count == 0) {
                    return conn.query(insertSql, [uc.user]).then(junk => console.log("added user " + user)).thenReturn(uc);
                } else {
                    return Promise.resolve(uc);
                }
            })
            .then(uc => doEnsureFileProcessUser(conn, uc.user).thenReturn(uc))
            .then(uc => doEnsureFileProcessUserCollection(conn, uc.user).thenReturn(uc))
            .then(uc => doEnsureFileProcessUserPlayed(conn, uc.user))
    }));
}

export function updateGamesForGeek(geek: string, games: [CollectionGame]): Promise<void[]> {
    let connection;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => doUpdateGamesForGeek(conn, geek, games))
        .then(() => connection.destroy());
}

function doUpdateGamesForGeek(conn: mysql.Connection, geek: string, games: [CollectionGame]): Promise<void[]> {
    const countSql = "select count(*) from geekgames where geek = ? and game = ?";
    const insertSql = "insert into geekgames (geek, game, rating, owned, want, wish, trade, prevowned, wanttobuy, wanttoplay, preordered) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const updateSql = "update geekgames (rating, owned, want, wish, trade, prevowned, wanttobuy, wanttoplay, preordered) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) where geek = ? and game = ?";
    return Promise.all(games.map(game => {
        return conn.query(countSql, [geek, game.gameId])
            .then(count => {
                if (count == 1) {
                    return conn.query(updateSql, [game.rating, game.owned, game.want, game.wishListPriority, game.forTrade,
                        game.prevOwned, game.wantToBuy, game.wantToPlay, game.preordered, geek, game.gameId]);
                } else {
                    return conn.query(insertSql, [geek, game.gameId, game.rating, game.owned, game.want, game.wishListPriority,
                    game.forTrade, game.prevOwned, game.wantToBuy, game.wantToPlay, game.preordered]);
                }
            });
    }));
}

export function ensureGames(games: [CollectionGame]): Promise<void[]> {
    let connection;
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => doEnsureGames(conn, games))
        .then(() => connection.destroy());
}

function doEnsureGames(conn: mysql.Connection, games: [CollectionGame]): Promise<void[]> {
    const GAME_URL = "https://boardgamegeek.com/xmlapi/boardgame/%d&stats=1";
    return Promise.all(games.map(game => {
        const url = GAME_URL.replace("%d", game.gameId.toString());
        return doRecordFile(conn, url, "processGame", null, "Game #" + game.gameId);
    }));
}

// promise returns how many rows were inserted
function doRecordFile(conn: mysql.Connection, url: string, processMethod: string, user: string, description: string): Promise<number> {
    const countSql = "select count(*) from files where url = ? and processMethod = ?";
    const insertSql = "insert into files (url, processMethod, geek, lastupdate, tillNextUpdate, description) values (?, ?, ?, ?, ?, ?)";
    return conn.query(countSql, [url, processMethod])
        .then(result => {
            const count = result[0]["count(*)"];
            if (count === 0) {
                const tillNext = TILL_NEXT_UPDATE[processMethod];
                const insertParams = [url, processMethod, user, null, tillNext, description];
                return conn.query(insertSql, insertParams)
                    .then(() => console.log("added url " + url))
                    .catch(err => console.log(err))
                    .thenReturn(1);
            } else {
                return Promise.resolve(0);
            }
        });
}

function doEnsureFileProcessUser(conn: mysql.Connection, geek: string): Promise<number> {
    const url = `https://boardgamegeek.com/user/${geek}`;
    return doRecordFile(conn, url, "processUser", geek, "User's profile");
}

function doEnsureFileProcessUserCollection(conn: mysql.Connection, geek: string): Promise<number> {
    const url = `https://boardgamegeek.com/xmlapi2/collection?username=${geek}&brief=1&stats=1`;
    return doRecordFile(conn, url, "processCollection", geek, "User collection - owned, ratings, etc");
}

function doEnsureFileProcessUserPlayed(conn: mysql.Connection, geek: string): Promise<number> {
    const url = `https://boardgamegeek.com/plays/bymonth/user/${geek}/subtype/boardgame`;
    return doRecordFile(conn, url, "processPlayed", geek, "Months in which user has played games");
}

export function listUsers(): Promise<[string]> {
    console.log("listUsers");
    const sql = "select username from geeks";
    let connection;
    let result: [string];
    return getConnection()
        .then(conn => {
            connection = conn;
            return conn;
        })
        .then(conn => conn.query(sql))
        .then(data => {
            result = data.map(row => row['username']);
        })
        .then(() => connection.destroy())
        .then(() => result);
}

export function listToProcess(count: number): Promise<[ToProcessElement]> {
    const sql = "select * from files where (lastUpdate is null || nextUpdate < now()) and (last_scheduled is null || TIMESTAMPDIFF(MINUTE, last_scheduled, now()) >= 10) limit ?";
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
    let connection;
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

function getConnection(): Promise {
    const params = {
        host: process.env.mysqlHost,
        user: process.env.mysqlUsername,
        password: process.env.mysqlPassword,
        database: process.env.mysqlDatabase
    };
    return mysql.createConnection(params);
}

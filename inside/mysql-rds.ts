import mysql = require('promise-mysql');
import {ToProcessElement} from "./interfaces";

export function updateUserValues(geek: string, bggid: number, country: string): Promise<void> {
    console.log("updateUserValues " + geek + " " + bggid + " " + country);
    const sql = "update geeks set country = ?, bggid = ? where username = ?";
    return getConnection().then(conn => conn.query(sql, [country, bggid, geek]));
}

// longest possible MySQL time is 838:59:59 hours: http://dev.mysql.com/doc/refman/5.5/en/date-and-time-type-overview.html
const TILL_NEXT_UPDATE = { 'processCollection' : '72:00:00', 'processMarket' : '72:00:00', 'processPlayed' : '72:00:00',
    'processGame' : '838:00:00', 'processTop50' : '72:00:00', "processFrontPage" : '24:00:00', "processUser": '838:00:00'  };


export function markUrlProcessed(processMethod: string, url: string): Promise<void> {
    console.log("markUrlProcessed " + url);
    const sqlGet = "get * from files where processMethod = ? and url = ?";
    const delta = TILL_NEXT_UPDATE[processMethod];
    const sqlSet = "update files set lastUpdate = now(), nextUpdate = addtime(now(), ?) where url = ?";
    return getConnection()
        .then(conn => conn.query(sqlSet, [delta, url]));
}

export const ensureUsers: (users: string[]) => Promise<void[]> = (users: string[]) => {
    return getConnection().then(conn => doEnsureUsers(conn, users));
};

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

// promise returns how many rows were inserted
function doRecordFile(conn: mysql.Connection, url: string, processMethod: string, user: string, description: string): Promise<number> {
    const countSql = "select count(*) from files where geek = ? and processMethod = ?";
    const insertSql = "insert into files (url, processMethod, geek, lastupdate, tillNextUpdate, description) values (?, ?, ?, ?, ?, ?)";
    return conn.query(countSql, [user, processMethod])
        .then(result => {
            const count = result[0]["count(*)"];
            if (count === 0) {
                const tillNext = TILL_NEXT_UPDATE[processMethod];
                const insertParams = [url, processMethod, user, null, tillNext, description];
                return conn.query(insertSql, insertParams).then(junk => console.log("added url " + url)).thenReturn(1);
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
    return getConnection()
        .then(conn => conn.query(sql))
        .then(result => result.map(row => row['username']));
}

export function listToProcess(count: number): Promise<[ToProcessElement]> {
    const sql = "select * from files where (lastUpdate is null || nextUpdate < now()) and (last_scheduled is null || TIMESTAMPDIFF(MINUTE, last_scheduled, now()) >= 10) limit ?";
    return getConnection()
        .then(conn => conn.query(sql, [count]))
        .then(result => result.map(row => row as ToProcessElement));
}

export function updateLastScheduledForUrls(urls: string[]): Promise<void> {
    const sqlOne = "update files set last_scheduled = now() where url = ?";
    const sqlMany = "update files set last_scheduled = now() where url in (?)";
    return getConnection()
        .then(conn => {
           if (urls.length == 0) {
               return Promise.resolve(undefined);
           } else if (urls.length == 1) {
               return conn.query(sqlOne, urls);
           } else {
               return conn.query(sqlMany, [urls]);
           }
        });
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

import mysql = require('promise-mysql');
import {Callback} from "aws-lambda";

const PROFILE_URL = "https://boardgamegeek.com/user/";

// function updateUserValues(geek: string, bggid: number, country: string): Promise {
//     return getConnection()
//         .then(conn => {
//
//         });
// }

export const ensureUsers: (users: string[]) => Promise<[number]> = (users: string[]) => {
    return getConnection().then(conn => doEnsureUsers(conn, users));
};

function doEnsureUsers(conn: mysql.Connection, users: string[]): Promise<[number]> {
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
            .then(uc => doEnsureFileProcessUser(conn, uc.user))
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

// longest possible MySQL time is 838:59:59 hours: http://dev.mysql.com/doc/refman/5.5/en/date-and-time-type-overview.html
const TILL_NEXT_UPDATE = { 'processCollection' : '72:00:00', 'processMarket' : '72:00:00', 'processPlayed' : '72:00:00',
    'processGame' : '838:00:00', 'processTop50' : '72:00:00', "processFrontPage" : '24:00:00' };

function doEnsureFileProcessUser(conn: mysql.Connection, user: string): Promise<number> {
    return doRecordFile(conn, PROFILE_URL + user, "processUser", user, "User's profile");
}

export const listUsers: (callback: Callback) => void = (callback: Callback) => {
    console.log("listUsers");
    const conn = getConnection();
    conn.connect(err => {
        if (err) {
            return callback(err);
        }
        console.log("listUsers connected");
        const sql = "select username from geeks";
        conn.query(sql, null, (err, result) => {
            if (err) {
                return callback(err);
            }
            const val = result.map(row => row['username']);
            console.log(val);
            console.log("listUsers complete");
            return callback(null, val);
        });
    });
};

export const listToProcess: (count: number, callback: Callback) => void = (count: number, callback: Callback) => {
    const conn = getConnection();
    conn.connect(err => {
        if (err) return callback(err);
        console.log("listToProcess connected");
        const sql = "select * from files where (lastUpdate is null || nextUpdate < now()) and (last_scheduled is null || TIMESTAMPDIFF(MINUTE, last_scheduled, now()) >= 10) limit " + count;
        conn.query(sql, null, (err, result) => {
            if (err) return callback(err);
            console.log(result);
            return callback(null, result);
        });
    });
};

export const updateLastScheduledForUrls: (urls: string[], callback: Callback) => void = (urls: string[], callback: Callback) => {
    const conn = getConnection();
    conn.connect(err => {
        if (err) return callback(err);
        console.log("updateLastScheduledForUrls connected");
        if (urls.length == 0) {
            callback(undefined, undefined);
        } else if (urls.length == 1) {
            const sql = "update files set last_scheduled = now() where url = ?";
            conn.query(sql, urls, (err, result) => {
                if (err) {
                    console.log(err);
                    return callback(err);
                }
                return callback(undefined, undefined);
            });
        } else {
            const sql = "update files set last_scheduled = now() where url in ?";
            conn.query(sql, [urls], (err, result) => {
                if (err) return callback(err);
                return callback(undefined, undefined);
            });
        }
    });
};

function getConnection(): Promise {
    const params = {
        host: process.env.mysqlHost,
        user: process.env.mysqlUsername,
        password: process.env.mysqlPassword,
        database: process.env.mysqlDatabase
    };
    return mysql.createConnection(params);
}

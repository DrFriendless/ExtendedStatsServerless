import mysql = require('mysql');
import {Callback} from "aws-lambda";

const PROFILE_URL = "https://boardgamegeek.com/user/";

export const ensureUsers: (users: string[]) => void = (users: string[]) => {
    const conn = getConnection();
    console.log(conn);
    return doEnsureUsers(conn, users);
};

function doEnsureUsers(conn: mysql.Connection, users: string[]) {
    conn.connect(err => {
        if (err) throw err;
        const countSql = "select count(*) from geeks where username = ?";
        const insertSql = "insert into geeks (username) values (?)";
        users.forEach(user => {
            conn.query(countSql, [user], (err, result) => {
                if (err) throw err;
                const count = result[0]["count(*)"];
                if (count === 0) {
                    conn.query(insertSql, [user]);
                }
                doEnsureFileProcessUser(conn, user);
            });
        });
    });
}

function doRecordFile(conn: mysql.Connection, url: string, processMethod: string, user: string, description: string) {
    const countSql = "select count(*) from files where geek = ? and processMethod = ?";
    const insertSql = "insert into files (url, processMethod, geek, lastupdate, tillNextUpdate, description) values (?, ?, ?, ?, ?, ?)";
    conn.query(countSql, [user, processMethod], (err, result) => {
        if (err) throw err;
        const count = result[0]["count(*)"];
        if (count === 0) {
            const tillNext = TILL_NEXT_UPDATE[processMethod];
            const insertParams = [url, processMethod, user, null, tillNext, description];
            conn.query(insertSql, insertParams);
            console.log("added user " + user);
        }
    });
}

// longest possible MySQL time is 838:59:59 hours: http://dev.mysql.com/doc/refman/5.5/en/date-and-time-type-overview.html
const TILL_NEXT_UPDATE = { 'processCollection' : '72:00:00', 'processMarket' : '72:00:00', 'processPlayed' : '72:00:00',
    'processGame' : '838:00:00', 'processTop50' : '72:00:00', "processFrontPage" : '24:00:00' };

function doEnsureFileProcessUser(conn: mysql.Connection, user: string) {
    doRecordFile(conn, PROFILE_URL + user, "processUser", user, "User's profile");
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

function getConnection(): mysql.Connection {
    const params = {
        host: process.env.mysqlHost,
        user: process.env.mysqlUsername,
        password: process.env.mysqlPassword,
        database: process.env.mysqlDatabase
    };
    return mysql.createConnection(params);
}

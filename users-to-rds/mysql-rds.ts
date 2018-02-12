import mysql = require('mysql');
import {Callback} from "aws-lambda";

const PROFILE_URL = "https://boardgamegeek.com/user/";

export const ensureUsers: (users: string[]) => void = (users: string[]) => {
    const conn = getConnection();
    console.log(conn);
    doEnsureUsers(conn, users);
};

function doEnsureUsers(conn: mysql.Connection, users: string[]) {
    console.log("doEnsureUser");
    conn.connect(err => {
        if (err) throw err;
        console.log("doEnsureUser Connected!");
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
        }
    });
}

// longest possible MySQL time is 838:59:59 hours: http://dev.mysql.com/doc/refman/5.5/en/date-and-time-type-overview.html
const TILL_NEXT_UPDATE = { 'processCollection' : '72:00:00', 'processMarket' : '72:00:00', 'processPlayed' : '72:00:00',
        'processGame' : '838:00:00', 'processTop50' : '72:00:00', "processFrontPage" : '24:00:00' };

function doEnsureFileProcessUser(conn: mysql.Connection, user: string) {
    console.log("doEnsureFileProcessUser");
    doRecordFile(conn, PROFILE_URL + user, "processUser", user, "User's profile");
}

export const listUsers: (callback: Callback) => void = (callback: Callback) => {
    console.log("listUsers");
    const conn = getConnection();
    conn.connect(err => {
        if (err) {
            callback(err);
            return;
        }
        console.log("listUsers connected");
        const sql = "select username from geeks";
        conn.query(sql, null, (err, result) => {
            if (err) {
                callback(err);
                return;
            }
            const val = result.map(row => row['username']);
            console.log(val);
            callback(null, val);
            console.log("listUsers complete");
        });
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

import {Configuration} from "./config";
import mysql = require('mysql');

export const ensureUser: (config: Configuration, user: string) => void = (config: Configuration, user: string) => {
    doEnsureUser(getConnection(config), user);
};

function doEnsureUser(conn: mysql.Connection, user: string) {
    console.log("doEnsureUser " + user);
    conn.connect(err => {
        if (err) throw err;
        console.log("doEnsureUser Connected!");
        // count = db.execute("select count(*) from geeks where username = '%s'" % geek)[0][0]
        // if count == 0l:
        //     db.execute("insert into geeks (username) values ('%s')" % geek)
        const countSql = "select count(*) from geeks where username = %s";
        conn.query(countSql, [user], (err, result) => {
            if (err) throw err;
            console.log("query results");
            console.log(result);
        });
    });
}

function getConnection(config: Configuration): mysql.Connection {
    return mysql.createConnection({
        host: config['mysqlHost'],
        user: config["mysqlUsername"],
        password: config["mysqlPassword"],
        database: config["mysqlDatabase"]
    });
}

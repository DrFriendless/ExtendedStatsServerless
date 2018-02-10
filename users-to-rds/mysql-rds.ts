import mysql = require('mysql');

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
            });
        });
    });
}

function getConnection(): mysql.Connection {
    console.log("getConnection");
    const params = {
        host: process.env.mysqlHost,
        user: process.env.mysqlUsername,
        password: process.env.mysqlPassword,
        database: process.env.mysqlDatabase
    };
    return mysql.createConnection(params);
}

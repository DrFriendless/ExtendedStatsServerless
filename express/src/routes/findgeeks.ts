import { Request, Response } from "express";
import { returnWithConnectionAsync } from "./library";

/**
 *
 * @param {} req
 * @param {} res
 */
export const findgeeks = async (req: Request, res: Response) => {
    const sql = "select username from geeks where LOWER(username) like ? order by 1 limit 10";
    const name = req.params["fragment"].toLowerCase().replace(/%/g, "");
    const matches = await returnWithConnectionAsync(async (conn) => {
        let ms = await conn.query(sql, name + "%");
        if (ms.length == 0) ms = await conn.query(sql, "%" + name + "%");
        return ms.map((row: { [key: string]: any }) => row["username"]);
    });
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(matches));
};

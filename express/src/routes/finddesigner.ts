import { Request, Response } from "express";
import { incrementExpressCounter, returnWithConnectionAsync } from "./library";

/**
 *
 * @param {} req
 * @param {} res
 */
export const finddesigner = async (req: Request, res: Response) => {
    await incrementExpressCounter();
    const sql = "select bggid, name from designers where bggid = ?";
    const f = (req.query["bggid"] || "").toString();
    const bggid = parseInt(f);
    console.log(`finddesigner ${bggid}}`);
    if (!bggid || isNaN(bggid)) {
        res.send("");
    } else {
        const matches = await returnWithConnectionAsync(async (conn) => {
            return await conn.query(sql, bggid) as { bggid: number, name: string }[];
        });
        res.send(matches.length === 0 ? "" : JSON.stringify(matches[0]));
    }
};

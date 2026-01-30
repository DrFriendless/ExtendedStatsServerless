import { Request, Response } from "express";
import { incrementExpressCounter, withConnectionAsync } from "./library";

/**
 *
 * @param {} req
 * @param {} res
 */
export async function count(req: Request, res: Response): Promise<void> {
    const f = (req.query["counts"] || "").toString();
    for (const s1 of f.split(",").filter(s => s.length > 0)) {
        switch (s1) {
            case "page":
                await withConnectionAsync(async conn => conn.query("update counters set page_views = page_views + 1"));
                break;
            case "blog":
                await withConnectionAsync(async conn => conn.query("update counters set blog_views = blog_views + 1"));
                break;
        }
    }
    await incrementExpressCounter();
    res.status(200);
}
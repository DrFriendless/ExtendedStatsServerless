import {BlogComment} from "extstats-core/blog-interfaces.js";
import {findSystem, HttpResponse, isHttpResponse, System} from "./system.mjs";
import {APIGatewayProxyEventV2WithRequestContext} from "aws-lambda/trigger/api-gateway-proxy.js";
import {OkPacket} from "mysql";

interface RawBlogComment {
    id: number;
    post_url: string;
    poster: string;
    comment: string;
    date: Date;
    reply_to: number | undefined;
    deleted: boolean;
}

export async function retrieveCommentsForUrl(event: APIGatewayProxyEventV2WithRequestContext<any>): Promise<BlogComment[] | HttpResponse> {
    const system = await findSystem(event);
    if (isHttpResponse(system)) return system;
    const url = event.queryStringParameters["url"];
    return await retrieveCommentsForUrlInternal(system, url);
}

async function retrieveCommentsForUrlInternal(system: System, url: string) {
    const sql = "select * from blog_comments where post_url = ?";
    const posts = await system.asyncReturnWithConnection(
        async conn => await conn.query(sql, [url]) as RawBlogComment[]
    );
    for (const p of posts) {
        if (p.deleted) {
            p.poster = "(deleted)";
            p.comment = "";
        }
    }
    return posts.map(rbp => {
        return {
            id: rbp.id,
            comment: rbp.comment,
            post_url: "",
            poster: rbp.poster,
            deleted: !!rbp.deleted,
            reply_to: rbp.reply_to || undefined,
            date: rbp.date
        } as BlogComment;
    });
}

export async function deleteComment(event: APIGatewayProxyEventV2WithRequestContext<any>):
    Promise<{ posts: BlogComment[] } | HttpResponse> {
    console.log(event);
    const system = await findSystem(event);
    if (isHttpResponse(system)) return system;
    if (!system.user) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: "You must be logged in to do this."})
        }
    }
    const body = JSON.parse(event.body);
    const id = body.id;
    if (!id) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: "That comment does not exist."})
        }
    }
    const sql = "select poster, post_url from blog_comments where id = ?";
    const found: { poster: string, post_url: string }[] =
        await system.asyncReturnWithConnection(async conn => await conn.query(sql, [id]));
    if (found.length === 0) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: "That comment does not exist."})
        }
    }
    if (found[0].poster !== system.user) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: "That comment doesn't belong to you."})
        }
    }

    const sqlUpdate = "update blog_comments set deleted = 1 where id = ?";
    await system.asyncReturnWithConnection(async conn => {
        const r = await conn.query(sqlUpdate, [ id ]);
    });

    const posts = await retrieveCommentsForUrlInternal(system, found[0].post_url);
    return { posts };
}

export async function saveComment(event: APIGatewayProxyEventV2WithRequestContext<any>):
    Promise<{ id: number | undefined, posts: BlogComment[] } | HttpResponse> {
    console.log(event);
    const system = await findSystem(event);
    if (isHttpResponse(system)) return system;
    if (!system.user) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: "You must be logged in to do this."})
        }
    }
    const body = JSON.parse(event.body);
    const url = body.url;
    const comment = body.comment;
    const replyTo: number | undefined = body["replyTo"];

    const sql = "insert into blog_comments (post_url, poster, comment, date, reply_to, deleted) values (?, ?, ?, now(), ?, 0)";
    const id: number = await system.asyncReturnWithConnection(async conn => {
        const r: OkPacket = await conn.query(sql, [ url, system.user, comment, replyTo ]);
        return r.insertId;
    });

    const posts = await retrieveCommentsForUrlInternal(system, url);
    return { id, posts };
}

export async function updateComment(event: APIGatewayProxyEventV2WithRequestContext<any>):
    Promise<{ id: number, posts: BlogComment[] } | HttpResponse> {
    const system = await findSystem(event);
    if (isHttpResponse(system)) return system;
    if (!system.user) {
        return {
            statusCode: 401,
            body: JSON.stringify({ error: "You must be logged in to do this."})
        }
    }
    const body = JSON.parse(event.body);
    const comment = body.comment;
    const id: number = body["id"];
    if (!id) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: "That comment does not exist."})
        }
    }
    const sql = "select poster, post_url from blog_comments where id = ?";
    const found: { poster: string, post_url: string }[] =
        await system.asyncReturnWithConnection(async conn => await conn.query(sql, [id]));
    if (found.length === 0) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: "That comment does not exist."})
        }
    }
    if (found[0].poster !== system.user) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: "That comment doesn't belong to you."})
        }
    }

    const sqlUpdate = "update blog_comments set comment = ? where id = ? and poster = ?";
    await system.asyncReturnWithConnection(async conn => {
        const r = await conn.query(sqlUpdate, [ comment, id, system.user ]);
    });

    const posts = await retrieveCommentsForUrlInternal(system, found[0].post_url);
    return { id, posts };
}
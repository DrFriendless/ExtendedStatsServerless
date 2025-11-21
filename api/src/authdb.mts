import {System} from "./system.mjs";

export interface Auth {
    created: Date;
    username: string;
    password: string;
    status: 'CONFIRMED' | 'WAITING';
}

export interface TaskData {
    type: "signup"
}

export interface AuthTask {
    created: Date;
    username: string;
    code: string;
    task: TaskData;
}

export async function loadAuth(system: System, username: string): Promise<Auth | undefined> {
    const sql = "select username, password, status, created from auth where username = ?";
    console.log(`loadAuth ${username}`);
    return system.asyncReturnWithConnection(async conn => {
        const matches = await conn.query({ sql, values: [ username ] }) as object[];
        console.log(matches);
        if (matches.length === 0) return undefined;
        return matches[0] as Auth;
    });
}

export async function loadAuthTasks(system: System, username: string): Promise<AuthTask[]> {
    const sql = "select created, code, task from authtask where username = ?";
    return system.asyncReturnWithConnection(async conn => {
        const matches = await conn.query({ sql, values: [ username ] }) as { created: Date, code: string, t: string }[];
        return matches.map(x => {
            return { created: x.created, code: x.code, username, task: JSON.parse(x.t) as TaskData };
        });
    });
}

export async function createAuth(system: System, auth: Auth): Promise<boolean> {
    const sql = "insert into auth (username, password, status, created) values (?, ?, ?, ?)";
    return system.asyncReturnWithConnection(async conn => {
        await conn.query({ sql, values: [ auth.username, auth.password, auth.status, auth.created ] });
        return true;
    });
}

export async function createAuthTask(system: System, task: AuthTask): Promise<boolean> {
    const sql = "insert into authtask (created, username, code, task) values (?, ?, ?, ?)";
    return system.asyncReturnWithConnection(async conn => {
        await conn.query({ sql, values: [ task.created, task.username, task.code, JSON.stringify(task.task) ] });
        return true;
    });
}

export async function deleteAuth(system: System, username: string): Promise<boolean> {
    const sql1 = "delete from auth where username = ?";
    const sql2 = "delete from authtask where username = ?";
    return system.asyncReturnWithConnection(async conn => {
        await conn.query({ sql: sql1, values: [ username ] });
        await conn.query({ sql: sql2, values: [ username ] });
        return true;
    });
}

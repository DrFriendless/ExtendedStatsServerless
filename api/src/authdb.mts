import {System} from "./system.mjs";

export interface Auth {
    created: Date;
    username: string;
    password: string;
    status: 'CONFIRMED' | 'WAITING';
}

export interface SignupTaskData {
    type: "signup";
}
export interface ChangePasswordTaskData {
    type: "changePassword";
    password: string;
}

type TaskData = SignupTaskData | ChangePasswordTaskData;

export interface AuthTask {
    id: number;
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
    const sql = "select id, created, code, task from authtask where username = ?";
    return system.asyncReturnWithConnection(async conn => {
        const matches = await conn.query({ sql, values: [ username ] }) as { id: number, created: Date, code: string, task: string }[];
        return matches.map(x => {
            return { id: x.id, created: x.created, code: x.code, username, task: JSON.parse(x.task) as TaskData };
        });
    });
}

export async function loadAuthTask(system: System, username: string, code: string): Promise<AuthTask[]> {
    const sql = "select id, created, task from authtask where username = ? and code = ?";
    return system.asyncReturnWithConnection(async conn => {
        const matches = await conn.query({ sql, values: [ username, code ] }) as { id: number, created: Date, task: string }[];
        console.log(matches);
        return matches.map(x => {
            return { id: x.id, created: x.created, code, username, task: JSON.parse(x.task) as TaskData };
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

export async function confirmSignup(system: System, username: string): Promise<boolean> {
    const sql = "update auth set status = 'CONFIRMED' where username = ?";
    return system.asyncReturnWithConnection(async conn => {
        await conn.query({ sql, values: [ username ] });
        return true;
    });
}

export async function confirmChangePassword(system: System, username: string, password: string): Promise<boolean> {
    const sql = "update auth set password = ? where username = ?";
    return system.asyncReturnWithConnection(async conn => {
        await conn.query({ sql, values: [ password, username ] });
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

export async function deleteAuthTask(system: System, id: number): Promise<boolean> {
    const sql = "delete from authtask where id = ?";
    return system.asyncReturnWithConnection(async conn => {
        await conn.query({ sql: sql, values: [ id ] });
        return true;
    });
}

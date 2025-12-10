import {System} from "./system.mjs";
import {AuthTableRow, AuthTask, TaskData} from "./interfaces.mjs";

export async function incrementLogin(system: System, username: string): Promise<void> {
    const sql = "update auth set loginCount = loginCount + 1 where username = ?";
    await system.asyncWithConnection(conn => conn.query(sql, [ username ]));
}

export async function doUpdateUserConfig(system: System, username: string, userConfig: any) {
    const updateSql = "update auth set configuration = ? where username = ?";
    await system.asyncWithConnection(conn => conn.query(updateSql, [JSON.stringify(userConfig), username]));
}

export async function loadAuth(system: System, username: string): Promise<AuthTableRow | undefined> {
    const sql = "select username, password, status, created, configuration, lastLogin, loginCount from auth where username = ?";
    return system.asyncReturnWithConnection(async conn => {
        const matches = await conn.query({ sql, values: [ username ] }) as object[];
        console.log(matches);
        if (matches.length === 0) return undefined;
        return matches[0] as AuthTableRow;
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
        return matches.map(x => {
            return { id: x.id, created: x.created, code, username, task: JSON.parse(x.task) as TaskData };
        });
    });
}

export async function createAuth(system: System, auth: AuthTableRow): Promise<boolean> {
    const sql = "insert into auth (username, password, status, created, loginCount) values (?, ?, ?, ?, 0)";
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

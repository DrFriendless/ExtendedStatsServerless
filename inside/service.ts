// Small layer which services the lambda functions by getting a database connection and invoking the database layer.
// Mostly exists so that there aren't quite so many functions in the database layer.

import {
    CollectionGame,
    MetadataRule,
    MonthPlayed,
    ProcessGameResult,
    ProcessPlaysResult, SeriesMetadata,
    ToProcessElement
} from "./interfaces";
import { returnWithConnection, withConnectionAsync } from "./library";
import {
    doEnsureGames,
    doEnsureUsers,
    doListToProcess,
    doMarkGameDoesNotExist,
    doMarkUrlProcessed,
    doMarkUrlTryTomorrow, doMarkUrlUnprocessed, doProcessCollectionCleanup,
    doProcessGameResult,
    doProcessPlayedMonths,
    doProcessPlaysResult, doUpdateBGGTop50,
    doUpdateGamesForGeek, doUpdateMetadata,
    doUpdateProcessUserResult, doUpdateRankings
} from './mysql-rds';

export async function runProcessGameResult(data: ProcessGameResult) {
    await withConnectionAsync(async conn => await doProcessGameResult(conn, data));
}

export async function runProcessUserResult(geek: string, bggid: number, country: string, url: string) {
    await withConnectionAsync(async conn => await doUpdateProcessUserResult(conn, geek, bggid, country, url));
}

export async function runUpdateGamesForGeek(geek: string, games: CollectionGame[]) {
    await withConnectionAsync(async conn => await doUpdateGamesForGeek(conn, geek, games));
}

export async function runEnsureUsers(users: string[]) {
    const uniques: string[] = [];
    for (let i = 0; i < users.length; i++) {
        if (uniques.indexOf(users[i]) >= 0) {
            console.log("User " + users[i] + " is duplicated in the users list.");
        } else {
            uniques.push(users[i]);
        }
    }
    await withConnectionAsync(conn => doEnsureUsers(conn, uniques));
}

export async function runEnsureGames(games: CollectionGame[]) {
    await withConnectionAsync(async conn => await doEnsureGames(conn, games.map(cg => cg.gameId)));
}

export async function runProcessPlayedMonths(geek: string, months: MonthPlayed[], url: string) {
    await withConnectionAsync(conn => doProcessPlayedMonths(conn, geek, months, url));
}

export async function runProcessPlaysResult(data: ProcessPlaysResult) {
    await withConnectionAsync(conn => doProcessPlaysResult(conn, data));
}

export async function runMarkUrlProcessed(processMethod: string, url: string) {
    await withConnectionAsync(async conn => await doMarkUrlProcessed(conn, processMethod, url));
}

export async function runMarkUrlUnprocessed(processMethod: string, url: string) {
    await withConnectionAsync(async conn => await doMarkUrlUnprocessed(conn, processMethod, url));
}

export async function runMarkUrlTryTomorrow(processMethod: string, url: string) {
    await withConnectionAsync(async conn => await doMarkUrlTryTomorrow(conn, processMethod, url));
}

export async function runMarkGameDoesNotExist(bggid: number) {
    await withConnectionAsync(async conn => await doMarkGameDoesNotExist(conn, bggid));
}

export async function runListToProcess(count: number, processMethod: string, updateLastScheduled: boolean): Promise<ToProcessElement[]> {
    return returnWithConnection(conn => doListToProcess(conn, count, processMethod, updateLastScheduled));
}

export async function runUpdateMetadata(series: SeriesMetadata[], rules: MetadataRule[]) {
    await withConnectionAsync(async conn => await doUpdateMetadata(conn, series, rules));
}

export async function runUpdateBGGTop50(games: number[]) {
    await withConnectionAsync(async conn => await doUpdateBGGTop50(conn, games));
}

export async function runUpdateRankings() {
    await withConnectionAsync(async conn => await doUpdateRankings(conn));
}

export async function runProcessCollectionCleanup(geek: string, items: number[], url: string) {
    await withConnectionAsync(async conn => await doProcessCollectionCleanup(conn, geek, items, url));
}


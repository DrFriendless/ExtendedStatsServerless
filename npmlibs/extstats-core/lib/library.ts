import {GameData} from "./collection-interfaces";

export function roundRating(r: number): number {
    let rating = Math.round(r);
    if (rating < 1) rating = 1;
    if (rating > 10) rating = 10;
    return rating;
}

export function makeGamesIndex(games: GameData[]): { [bggid: number]: GameData } {
    const result = {} as  { [bggid: number]: GameData };
    games.forEach(gd => result[gd.bggid] = gd);
    return result;
}

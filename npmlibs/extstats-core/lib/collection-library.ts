import {GameData} from "./collection-interfaces";

export function makeGamesIndex(games: GameData[]): { [bggid: number]: GameData } {
    const result: { [bggid: number]: GameData } = {};
    games.forEach(gd => result[gd.bggid] = gd);
    return result;
}

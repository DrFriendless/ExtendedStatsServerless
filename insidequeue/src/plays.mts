import lodash from "lodash";
import {extractNormalisedPlayFromPlayRow, playDate, PlaysRow, splitBy, groupBy} from "./library.mjs";
import {ExpansionData} from "extstats-core";

export interface NormalisedPlays {
    quantity: number;
    game: number;
    geek: number;
    date: number;
    month: number;
    year: number;
    baseplay?: number;
    expansionPlay: boolean;
    id?: number;
    location: string;
}

export interface WorkingNormalisedPlays {
    expansions: number[];
    isExpansion: boolean;
    quantity: number;
    game: number;
    geek: number;
    date: number;
    month: number;
    year: number;
    location: string;
}

export function toWorkingPlay(expansionData: ExpansionData, play: NormalisedPlays): WorkingNormalisedPlays {
    return {
        quantity: play.quantity,
        game: play.game,
        geek: play.geek,
        date: play.date,
        month: play.month,
        year: play.year,
        location: play.location,
        isExpansion: expansionData.isExpansion(play.game),
        expansions: []
    };
}

export function sumQuantities(plays: WorkingNormalisedPlays[]): WorkingNormalisedPlays {
    if (plays.length === 1) return plays[0];
    plays[0].quantity = plays.map(p => p.quantity).reduce((a, b) => a + b);
    return plays[0];
}

export function coalescePlays(initial: WorkingNormalisedPlays[]): WorkingNormalisedPlays[] {
    const byGame = splitBy(initial, wnp => wnp.game.toString());
    return lodash.flatten(byGame.map(plays => splitBy(plays, ps => ps.location))).map(sumQuantities);
}

// figure out the canonical list of plays for a single geek on a single date
export function inferExtraPlays(initialPlays: NormalisedPlays[], expansionData: ExpansionData): WorkingNormalisedPlays[] {
    let current = initialPlays.map(play => toWorkingPlay(expansionData, play));
    current = coalescePlays(current);
    let iterations = 0;
    while (iterations < 10) {
        iterations++;
        const newPlays = inferNewPlays(current, expansionData);
        if (!newPlays) return current;
        current = newPlays;
    }
    console.log("Too many iterations");
    console.log(JSON.stringify(initialPlays));
    return current;
}


export function splitPlaysByDateAndLocation(plays: NormalisedPlays[]): NormalisedPlays[][] {
    const splitByDate: NormalisedPlays[][] = Object.values(groupBy(plays, playDate));
    return lodash.flatMap(
        splitByDate.map(
            (ps: NormalisedPlays[]) => Object.values(groupBy(ps,
                (p: NormalisedPlays) => p.location))));
}

export function normalise(rows: PlaysRow[], geekId: number, month: number, year: number,
                          expansionData: ExpansionData): WorkingNormalisedPlays[] {
    const rawData: NormalisedPlays[] = rows.map(row => extractNormalisedPlayFromPlayRow(row, geekId, month, year));
    const byDate: NormalisedPlays[][] = splitPlaysByDateAndLocation(rawData);
    return lodash.flatMap(byDate.map((plays: NormalisedPlays[]) => inferExtraPlays(plays, expansionData)));
}

function inferNewPlays(current: WorkingNormalisedPlays[], expansionData: ExpansionData): WorkingNormalisedPlays[] | undefined {
    const expansionPlays = current.filter(play => play.isExpansion);
    for (const expansionPlay of expansionPlays) {
        for (const basegamePlay of current) {
            if (Object.is(expansionPlay, basegamePlay)) continue;
            const couldExpand = expansionData.isBasegameOf(basegamePlay.game, expansionPlay.game) ||
                expansionData.isAnyBasegameOf(basegamePlay.expansions, expansionPlay.game);
            if (couldExpand && basegamePlay.expansions.indexOf(expansionPlay.game) < 0) {
                // basegamePlay could have included expansionPlay as an expansion, so we're going to say that it did
                const newQuantity = Math.min(expansionPlay.quantity, basegamePlay.quantity);
                expansionPlay.quantity -= newQuantity;
                basegamePlay.quantity -= newQuantity;
                const newPlay: WorkingNormalisedPlays = {
                    quantity: newQuantity,
                    game: basegamePlay.game,
                    geek: basegamePlay.geek,
                    date: basegamePlay.date,
                    month: basegamePlay.month,
                    year: basegamePlay.year,
                    location: basegamePlay.location,
                    isExpansion: basegamePlay.isExpansion,
                    expansions: lodash.flatten([expansionPlay.game, expansionPlay.expansions, basegamePlay.expansions])
                };
                const newPlays = current.filter(p => !Object.is(p, basegamePlay) && !Object.is(p, expansionPlay));
                newPlays.push(newPlay);
                if (expansionPlay.quantity > 0) newPlays.push(expansionPlay);
                if (basegamePlay.quantity > 0) newPlays.push(basegamePlay);
                return newPlays;
            }
        }
        // we couldn't find a play which might be a basegame play - can we guess one?
        const basegame = expansionData.getUniqueBasegame(expansionPlay.game);
        if (basegame) {
            const expansions = expansionPlay.expansions.slice();
            expansions.push(expansionPlay.game);
            const newPlay: WorkingNormalisedPlays = {
                quantity: expansionPlay.quantity,
                game: basegame,
                geek: expansionPlay.geek,
                date: expansionPlay.date,
                month: expansionPlay.month,
                year: expansionPlay.year,
                location: expansionPlay.location,
                isExpansion: expansionData.isExpansion(basegame),
                expansions
            };
            const newPlays = current.filter(p => !Object.is(p, expansionPlay));
            newPlays.push(newPlay);
            return newPlays;
        } else {
            const provable = getProvableBasegames(expansionPlay.game, expansionData);
            if (provable.length > 0) {
                const basegame = provable[0];
                const expansions = expansionPlay.expansions.slice();
                expansions.push(expansionPlay.game);
                expansions.push(...provable.slice(1));
                const newPlay: WorkingNormalisedPlays = {
                    quantity: expansionPlay.quantity,
                    game: basegame,
                    geek: expansionPlay.geek,
                    date: expansionPlay.date,
                    month: expansionPlay.month,
                    year: expansionPlay.year,
                    location: expansionPlay.location,
                    isExpansion: expansionData.isExpansion(basegame),
                    expansions
                };
                const newPlays = current.filter(p => !Object.is(p, expansionPlay));
                newPlays.push(newPlay);
                return newPlays;
            }
        }
    }
    return undefined;
}

function getProvableBasegames(game: number, ed: ExpansionData): number[] {
    const chains = ed.getPossibleBasegameChains(game);
    if (chains.length === 0) return [];
    if (chains.length === 1) return chains[0];
    let result = chains[0];
    for (const chain of chains.slice(1)) {
        result = result.filter(g => chain.indexOf(g) >= 0);
    }
    return result;
}



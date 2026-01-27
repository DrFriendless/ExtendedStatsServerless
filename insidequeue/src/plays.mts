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

/**
 * Figure out the canonical list of plays for a single geek on a single date.
 *
 * @param initialPlays - plays for the date grouped by known location.
 * Empty location is wild.
 * @param expansionData
 * @param baseGameDefaults
 */
export function inferExtraPlays(initialPlays: Record<string, NormalisedPlays[]>, expansionData: ExpansionData, baseGameDefaults: Record<string, number>): WorkingNormalisedPlays[] {
    // turn the value of initialPlays into coalesced working plays
    const current: Record<string, WorkingNormalisedPlays[]> = lodash.mapValues(lodash.mapValues(initialPlays,
        plays => plays.map(p => toWorkingPlay(expansionData,p))), coalescePlays);
    let wildcards = current[""] || [];
    delete current[""];

    let result: WorkingNormalisedPlays[] = [];
    Object.values(current).forEach(forLoc => {
            const { plays, wildcardRemainder } = inferExtraPlaysForLocation(forLoc, wildcards, expansionData, baseGameDefaults);
            result = result.concat(plays);
            wildcards = wildcardRemainder;
        }
    );
    const { plays, wildcardRemainder } = inferExtraPlaysForLocation(wildcards, [], expansionData, baseGameDefaults)
    result = result.concat(plays);
    // wildcardRemainder will be empty anyway
    return result;
}

/**
 *
 * @param input - plays which say they are at the location
 * @param wildcards - plays which do not specify a location
 * @param expansionData
 * @param baseGameDefaults
 */
function inferExtraPlaysForLocation(input: WorkingNormalisedPlays[], wildcards: WorkingNormalisedPlays[], expansionData: ExpansionData, baseGameDefaults: Record<string, number>):
    { plays: WorkingNormalisedPlays[], wildcardRemainder: WorkingNormalisedPlays[] } {
    let current = input;
    let wildcardRemainder = wildcards;
    let iterations = 0;
    while (iterations < 10) {
        iterations++;
        const { playsAtLocation, remainingWildcards, anyModification } = inferNewPlaysAtLocation(current, wildcardRemainder, expansionData);
        if (!anyModification) break;
        current = playsAtLocation;
        wildcardRemainder = remainingWildcards;
    }
    // try to invent base game plays for the other expansion plays
    const expansionPlaysAtLocation = current.filter(play => play.isExpansion);
    current = current.filter(play => !play.isExpansion);
    const unresolvableExpansionPlays: WorkingNormalisedPlays[] = [];
    while (expansionPlaysAtLocation.length > 0) {
        const ep = expansionPlaysAtLocation[0];
        let uniqueBaseGame = expansionData.getUniqueBasegame(ep.game);
        if (uniqueBaseGame === undefined) uniqueBaseGame = baseGameDefaults[ep.game];
        if (uniqueBaseGame !== undefined) {
            const newBgp: WorkingNormalisedPlays = { ...ep, game: uniqueBaseGame, isExpansion: false, expansions: [ep.game] };
            iterations = 0;
            let newPlays = [ newBgp ];
            while (iterations < 10) {
                iterations++;
                const { playsAtLocation, remainingWildcards, anyModification } = inferNewPlaysAtLocation(newPlays, wildcardRemainder, expansionData);
                if (!anyModification) break;
                newPlays = playsAtLocation;
                wildcardRemainder = remainingWildcards;
            }
            current = current.concat(newPlays);
        } else {
            unresolvableExpansionPlays.push(ep);
        }
        expansionPlaysAtLocation.splice(0, 1);
    }
    return { plays: current.concat(unresolvableExpansionPlays), wildcardRemainder };
}

function inferNewPlaysAtLocation(current: WorkingNormalisedPlays[], wildcards: WorkingNormalisedPlays[], expansionData: ExpansionData):
    { playsAtLocation: WorkingNormalisedPlays[], remainingWildcards: WorkingNormalisedPlays[], anyModification: boolean } {
    let baseGameWildcards = wildcards.filter(play => !play.isExpansion);
    let expansionWildcards = wildcards.filter(play => play.isExpansion);
    let expansionPlays = current.filter(play => play.isExpansion);
    const baseGamePlays = current.filter(play => !play.isExpansion);

    let anyModification = false;
    // allocate expansions to base game plays at the location
    let modified = true;
    while (modified) {
        modified = false;
        if (expansionWildcards.length === 0 && expansionPlays.length === 0) break;
        for (const bgp of baseGamePlays) {
            // look for expansion plays at the same location
            const eps = expansionPlays.filter(ep => couldExpand(expansionData, bgp, ep));
            // expansions for which we have found an expansion play
            const addedExpansions = eps.map(ep => ep.game);
            const weps = expansionWildcards
                .filter(wep => couldExpand(expansionData, bgp, wep))
                .filter(wep => addedExpansions.indexOf(wep.game) < 0);
            const min = Math.min(bgp.quantity, ...eps.map(ep => ep.quantity), ...weps.map(wep => wep.quantity));
            if ((eps.length > 0 || weps.length > 0) && min > 0) {
                modified = true;
                anyModification = true;
                let newBgp: WorkingNormalisedPlays | undefined = undefined;
                if (min < bgp.quantity) {
                    newBgp = {...bgp};
                    newBgp.quantity -= min;
                    bgp.quantity = min;
                }
                // update bgp in-situ
                eps.forEach(ep => bgp.expansions.push(ep.game));
                weps.forEach(wep => bgp.expansions.push(wep.game));
                expansionPlays = subtractPlays(expansionPlays, eps.map(ep => ep.game), min);
                expansionWildcards = subtractPlays(expansionWildcards, weps.map(wep => wep.game), min);
                if (newBgp) baseGamePlays.push(newBgp);
                break;
            }
        }
    }
    // allocate expansion plays at the location to wildcard base game plays
    modified = true;
    while (modified) {
        modified = false;
        if (expansionPlays.length === 0) break;
        for (const bgp of baseGameWildcards) {
            const eps = expansionPlays.filter(ep => couldExpand(expansionData, bgp, ep));
            if (eps.length > 0) {
                // expansions for which we have found an expansion play
                const addedExpansions = eps.map(ep => ep.game);
                const weps = expansionWildcards
                    .filter(wep => couldExpand(expansionData, bgp, wep))
                    .filter(wep => addedExpansions.indexOf(wep.game) < 0);
                const min = Math.min(bgp.quantity, ...eps.map(ep => ep.quantity), ...weps.map(wep => wep.quantity));
                if (min > 0) {
                    modified = true;
                    anyModification = true;
                    let newBgp: WorkingNormalisedPlays | undefined = undefined;
                    if (min < bgp.quantity) {
                        newBgp = {...bgp};
                        newBgp.quantity -= min;
                        bgp.quantity = min;
                    }
                    // update bgp in-situ
                    bgp.location = eps[0].location;
                    baseGamePlays.push(bgp);
                    baseGameWildcards = baseGameWildcards.filter(p => !p.location);
                    eps.forEach(ep => bgp.expansions.push(ep.game));
                    weps.forEach(wep => bgp.expansions.push(wep.game));
                    expansionPlays = subtractPlays(expansionPlays, eps.map(ep => ep.game), min);
                    expansionWildcards = subtractPlays(expansionWildcards, weps.map(wep => wep.game), min);
                    if (newBgp) baseGameWildcards.push(newBgp);
                    break;
                } else {
                    console.log("Sometjing went wrong");
                }
            }
        }
    }
    return { playsAtLocation: baseGamePlays.concat(expansionPlays), remainingWildcards: baseGameWildcards.concat(expansionWildcards), anyModification}
}

/**
 * Say we have an expansion X, which has multiple basegames. We write A -> X to mean "X expands A".
 * We can have A -> X, B -> X, in which case we don't know anything they played.
 * But we could have A -> C -> X, A -> B -> X in which case we know they played A but we don't know whether they played B or C.
 * This method, given X, returns all games they must have played.
 *
 * @param game
 * @param ed
 */
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

export function splitPlaysByDateAndLocation(plays: NormalisedPlays[]): Record<string, NormalisedPlays[]>[] {
    const splitByDate: NormalisedPlays[][] = Object.values(groupBy(plays, playDate));
    return splitByDate.map(plays => groupBy(plays, p => (p.location || "").trim()))
}

export function normalise(rows: PlaysRow[], geekId: number, month: number, year: number,
                          expansionData: ExpansionData, baseGameDefaults: Record<string, number>): WorkingNormalisedPlays[] {
    const rawData: NormalisedPlays[] = rows.map(row => extractNormalisedPlayFromPlayRow(row, geekId, month, year));
    const byDate: Record<string, NormalisedPlays[]>[] = splitPlaysByDateAndLocation(rawData);
    return lodash.flatMap(byDate.map((plays: Record<string, NormalisedPlays[]>) => inferExtraPlays(plays, expansionData, baseGameDefaults)));
}

// src gets modified during this operation
function subtractPlays(src: WorkingNormalisedPlays[], played: number[], quantity: number) {
    src.forEach(p => {
        if (played.indexOf(p.game) >= 0)  p.quantity -= quantity;
    });
    return src.filter(p => p.quantity > 0);
}

function couldExpand(expansionData: ExpansionData, bgp: WorkingNormalisedPlays, e: WorkingNormalisedPlays): boolean {
    return (expansionData.isBasegameOf(bgp.game, e.game) || expansionData.isAnyBasegameOf(bgp.expansions, e.game)) &&
        bgp.expansions.indexOf(e.game) < 0;
}
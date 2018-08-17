import {some} from "lodash";
import {mapValues} from "lodash";
import {groupBy} from "lodash";

export interface ExpansionRow {
    basegame: number;
    expansion: number;
}

export class ExpansionData {
    private readonly gameToExpansions: { [game: number]: number[] };
    private readonly expansionToBaseGames: { [game: number]: number[] };

    constructor(rows: ExpansionRow[]) {
        this.gameToExpansions = mapValues(groupBy(rows, (row: ExpansionRow) => row.basegame), (rs: ExpansionRow[]) => rs.map(row => row.expansion));
        this.expansionToBaseGames = mapValues(groupBy(rows, (row: ExpansionRow) => row.expansion), (rs: ExpansionRow[]) => rs.map(row => row.basegame));
    }

    public isExpansion(game: number): boolean {
        return !!this.expansionToBaseGames[game];
    }

    public isBasegameOf(maybeBaseGame: number, maybeExpansion: number): boolean {
        const exps = this.gameToExpansions[maybeBaseGame] as number[];
        return exps && exps.indexOf(maybeExpansion) >= 0;
    }

    public isAnyBasegameOf(maybeBaseGames: number[], maybeExpansion: number): boolean {
        const basegames = this.expansionToBaseGames[maybeExpansion] as number[];
        return basegames && some(maybeBaseGames, (mbg: number) => basegames.indexOf(mbg) >= 0);
    }

    public getUniqueBasegame(expansion: number): number | undefined {
        const basegames = this.expansionToBaseGames[expansion];
        if (basegames && basegames.length == 1) return basegames[0];
        return undefined;
    }
}

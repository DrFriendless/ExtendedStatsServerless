import {
    coalescePlays,
    inferExtraPlays,
    normalise,
    splitPlaysByDateAndLocation,
    sumQuantities,
    toWorkingPlay
} from "../src/plays";
import {NormalisedPlays, WorkingNormalisedPlays} from "../src/interfaces";
import * as bob from "../src/plays";
import {extractNormalisedPlayFromPlayRow, PlaysRow} from "../src/library";
import {ExpansionData} from "extstats-core";

const MTG = 463;
const CARC = 822;
const THE_RIVER = 2591;
const RACE = 28143;
const GATHERING_STORM = 34499;
const NEW_WORLDS = 242309;
const AGRICOLA = 31260;
const FOTM = 43018;
const AGRICOLA_REVISED = 200680;
const FOTM_REVISED = 257344;
const NEWDALE = 292850;
const LOTR_LCG = 77423;
const KHAZAD_DUM = 107933;
const SHADOW_AND_FLAME = 166715;
// the code under test destructively modifies these, so we need a new one for each test
const ONE_PLAY_OF_BEST_GAME = () => {
    return { expansions: [], isExpansion: false, quantity: 1, game: 320, geek: 1, date: 1, month: 1, year: 2020, location: "Home" }
};
const TWO_PLAYS_OF_BEST_GAME = () => {
    return { expansions: [], isExpansion: false, quantity: 2, game: 320, geek: 1, date: 1, month: 1, year: 2020, location: "Home" }
};
const ONE_PLAY_OF_MTG = () => {
    return { expansions: [], isExpansion: false, quantity: 1, game: MTG, geek: 1, date: 1, month: 1, year: 2020, location: "Home" }
};
const THREE_PLAYS_OF_MTG = () => {
    return { expansions: [], isExpansion: false, quantity: 3, game: MTG, geek: 1, date: 1, month: 1, year: 2020, location: "Home" }
};
const THREE_PLAYS_OF_MTG_ONLINE = () => {
    return { expansions: [], isExpansion: false, quantity: 3, game: MTG, geek: 1, date: 1, month: 1, year: 2020, location: "Online" }
};

const NORM_ONE_PLAY_OF_CARC: () => NormalisedPlays = () => {
    return { quantity: 1, game: CARC, location: "Carcassonne", date: 31, year: 2016, month: 12, geek: 23,
        expansionPlay: false };
};
const NORM_ONE_PLAY_OF_RACE_AT_HOME: () => NormalisedPlays = () => {
    return { quantity: 1, game: RACE, location: "Home", date: 31, year: 2016, month: 12, geek: 23,
        expansionPlay: false };
};
const NORM_ONE_PLAY_OF_GATHERING_STORM_ONLINE: () => NormalisedPlays = () => {
    return { quantity: 1, game: GATHERING_STORM, location: "Online", date: 31, year: 2016, month: 12, geek: 23,
        expansionPlay: false };
};

function playAt(game: number, quantity: number = 1, location: string = "Home", playDate: string = "2020-02-04"): PlaysRow {
    return { location, quantity, playDate, game };
}
const GATHERING_STORM_AT_HOME: () => PlaysRow = () => {
    return { location: "Home", quantity: 2, playDate: "2020-01-03", game: GATHERING_STORM };
};
const GATHERING_STORM_AT_ONLINE: () => PlaysRow = () => {
    return { location: "Online", quantity: 2, playDate: "2020-01-03", game: GATHERING_STORM };
};
const NEW_WORLDS_ONLINE: () => PlaysRow = () => {
    return { location: "Online", quantity: 1, playDate: "2020-01-03", game: NEW_WORLDS };
};
const ED = new ExpansionData([
    { basegame: CARC, expansion: THE_RIVER },
    { basegame: RACE, expansion: GATHERING_STORM },
    { basegame: RACE, expansion: NEW_WORLDS },
    { basegame: AGRICOLA, expansion: FOTM },
    { basegame: AGRICOLA_REVISED, expansion: FOTM_REVISED },
    { basegame: AGRICOLA, expansion: NEWDALE },
    { basegame: AGRICOLA_REVISED, expansion: NEWDALE },
    { basegame: LOTR_LCG, expansion: KHAZAD_DUM },
    { basegame: KHAZAD_DUM, expansion: SHADOW_AND_FLAME }
]);

// this test exists solely to show me what's exported from the code under test, because this testing framework
// doesn't recompile that code, so changes are not immediately reflected.
test('bob', () => {
    console.log(bob);
});

describe('sum quantities', () => {
    it('should sum quantities and preserve the game', () => {
        const src: WorkingNormalisedPlays[] = [ ONE_PLAY_OF_BEST_GAME(), TWO_PLAYS_OF_BEST_GAME() ];
        const summed = sumQuantities(src);
        expect(summed.quantity).toBe(3);
        expect(summed.game).toBe(320);
    })
});

describe('coalesce plays', () => {
    it("should split games and sum quantities", () => {
        const src: WorkingNormalisedPlays[] = [
            ONE_PLAY_OF_BEST_GAME(), ONE_PLAY_OF_MTG(), THREE_PLAYS_OF_MTG(), TWO_PLAYS_OF_BEST_GAME()
        ];
        const coalesced = coalescePlays(src);
        expect(coalesced.length).toBe(2);
        expect(find(320, coalesced).quantity).toBe(3);
        expect(find(MTG, coalesced).quantity).toBe(4);
    });
    it('should merge plays with same location', () => {
        const src: WorkingNormalisedPlays[] = [
            ONE_PLAY_OF_MTG(), THREE_PLAYS_OF_MTG()
        ];
        const coalesced = coalescePlays(src);
        expect(coalesced.length).toBe(1);
        expect(find(MTG, coalesced).quantity).toBe(4);
    });
    it('should not merge plays with different locations', () => {
        const src: WorkingNormalisedPlays[] = [
            ONE_PLAY_OF_MTG(), THREE_PLAYS_OF_MTG_ONLINE()
        ];
        const coalesced = coalescePlays(src);
        expect(coalesced.length).toBe(2);
        expect(findWithLocation(MTG, "Home", coalesced).quantity).toBe(1);
        expect(findWithLocation(MTG, "Online", coalesced).quantity).toBe(3);
    })
});

describe('extract normalised play from plays row', () => {
    it ("should copy location", () => {
        const row: PlaysRow = { game: 320, playDate: "2011-11-20", quantity: 2, location: "Djakarta" };
        const norm = extractNormalisedPlayFromPlayRow(row, 17, 11, 2011);
        expect(norm.geek).toBe(17);
        expect(norm.location).toBe("Djakarta");
        expect(norm.quantity).toBe(2);
        expect(norm.game).toBe(320);
        expect(norm.date).toBe(20);
    });
    it ("should handle date with spaces", () => {
        // for some reason the code seemed to use spaces rather than dashes, although the database
        // contains dashes and everything seems to have been working??? So let's make sure spaces work anyway.
        const row: PlaysRow = { game: 320, playDate: "2011 11 21", quantity: 2, location: "Djakarta" };
        const norm = extractNormalisedPlayFromPlayRow(row, 17, 11, 2011);
        expect(norm.date).toBe(21);
    });
});

describe('to working play', () => {
    it('should copy location', () => {
        const wp = toWorkingPlay(ED, NORM_ONE_PLAY_OF_CARC());
        expect(wp.location).toBe("Carcassonne");
        expect(wp.game).toBe(CARC);
        expect(wp.quantity).toBe(1);
    })
});

describe('infer extra plays', () => {
    it('should merge games on same date and same location', () => {
        const playRows = [ GATHERING_STORM_AT_ONLINE(), NEW_WORLDS_ONLINE() ];
        const normalised = playRows.map(row => extractNormalisedPlayFromPlayRow(row, 48,1, 2020));
        const working = inferExtraPlays(normalised, ED);
        const totalPlays = sum(working.map(p => p.quantity));
        expect(totalPlays).toBe(2);
    });
});

describe('normalise', () => {
    it('should not merge games on same date and different location', () => {
        const playRows = [ GATHERING_STORM_AT_HOME(), NEW_WORLDS_ONLINE() ];
        const normalised: WorkingNormalisedPlays[] = normalise(playRows, 746,3,2020, ED);
        expect(findWithLocation(RACE, "Home", normalised).quantity).toBe(2);
        expect(findWithLocation(RACE, "Home", normalised).expansions).toStrictEqual([GATHERING_STORM]);
        expect(findWithLocation(RACE, "Online", normalised).quantity).toBe(1);
        expect(findWithLocation(RACE, "Online", normalised).expansions).toStrictEqual([NEW_WORLDS]);
        expect(findWithLocation(GATHERING_STORM, "Home", normalised).quantity).toBe(2);
        expect(findWithLocation(NEW_WORLDS, "Online", normalised).quantity).toBe(1);
    });

    it('should infer base play from expansion', () => {
        const playRows = [ playAt(FOTM_REVISED) ];
        const normalised: WorkingNormalisedPlays[] = normalise(playRows, 746,2,2020, ED);
        expect(normalised.length).toBe(1);
        const basePlay = find(AGRICOLA_REVISED, normalised);
        expect(basePlay.location).toBe("Home");
        expect(basePlay.quantity).toBe(1);
        expect(basePlay.expansions).toStrictEqual([FOTM_REVISED]);
        expect(basePlay.isExpansion).toBe(false);
    });

    it('should not infer base play from ambiguous expansion', () => {
        const playRows = [ playAt(NEWDALE) ];
        const normalised: WorkingNormalisedPlays[] = normalise(playRows, 746,2,2020, ED);
        expect(normalised.length).toBe(1);
        const basePlay = find(NEWDALE, normalised);
        expect(basePlay.quantity).toBe(1);
        expect(basePlay.expansions).toStrictEqual([]);
        expect(basePlay.isExpansion).toBe(true);
        expect(basePlay.game).toBe(NEWDALE);
    });

    it('should infer correct base play from another expansion', () => {
        const playRows = [ playAt(NEWDALE), playAt(FOTM) ];
        const normalised: WorkingNormalisedPlays[] = normalise(playRows, 746,2,2020, ED);
        expect(normalised.length).toBe(1);
        const basePlay = find(AGRICOLA, normalised);
        expect(basePlay.quantity).toBe(1);
        expect(basePlay.expansions).toStrictEqual([NEWDALE, FOTM]);
        expect(basePlay.isExpansion).toBe(false);
        expect(basePlay.game).toBe(AGRICOLA);
    });

    it('should split ambiguous plays over separate expansions', () => {
        const playRows = [ playAt(NEWDALE, 2), playAt(FOTM), playAt(FOTM_REVISED) ];
        const normalised: WorkingNormalisedPlays[] = normalise(playRows, 746,2,2020, ED);
        expect(normalised.length).toBe(2);
        const basePlay = find(AGRICOLA, normalised);
        expect(basePlay.quantity).toBe(1);
        expect(basePlay.expansions).toStrictEqual([NEWDALE, FOTM]);
        expect(basePlay.isExpansion).toBe(false);
        expect(basePlay.game).toBe(AGRICOLA);
        const basePlay2 = find(AGRICOLA_REVISED, normalised);
        expect(basePlay2.quantity).toBe(1);
        expect(basePlay2.expansions).toStrictEqual([NEWDALE, FOTM_REVISED]);
        expect(basePlay2.isExpansion).toBe(false);
        expect(basePlay2.game).toBe(AGRICOLA_REVISED);
    });

    it('should leave ambiguous plays unexplained', () => {
        const playRows = [ playAt(NEWDALE, 2), playAt(FOTM) ];
        const normalised: WorkingNormalisedPlays[] = normalise(playRows, 746,2,2020, ED);
        expect(normalised.length).toBe(2);
        const basePlay = find(AGRICOLA, normalised);
        expect(basePlay.quantity).toBe(1);
        expect(basePlay.expansions).toStrictEqual([NEWDALE, FOTM]);
        expect(basePlay.isExpansion).toBe(false);
        expect(basePlay.game).toBe(AGRICOLA);
        const newdale = findWithBaseGame(NEWDALE, normalised);
        expect(newdale.quantity).toBe(1);
        expect(newdale.expansions).toStrictEqual([]);
        expect(newdale.isExpansion).toBe(true);
        expect(newdale.game).toBe(NEWDALE);
    });

    it('should infer missing middle game', () => {
        const playRows = [ playAt(SHADOW_AND_FLAME), playAt(LOTR_LCG) ];
        const normalised: WorkingNormalisedPlays[] = normalise(playRows, 746,2,2020, ED);
        expect(normalised.length).toBe(1);
        const basePlay = find(LOTR_LCG, normalised);
        expect(basePlay.quantity).toBe(1);
        expect(basePlay.expansions).toStrictEqual([KHAZAD_DUM, SHADOW_AND_FLAME]);
        expect(basePlay.isExpansion).toBe(false);
        expect(basePlay.game).toBe(LOTR_LCG);
    });

    it('should infer missing middle game and base game', () => {
        const playRows = [ playAt(SHADOW_AND_FLAME) ];
        const normalised: WorkingNormalisedPlays[] = normalise(playRows, 746,2,2020, ED);
        expect(normalised.length).toBe(1);
        const basePlay = find(LOTR_LCG, normalised);
        expect(basePlay.quantity).toBe(1);
        expect(basePlay.expansions).toStrictEqual([SHADOW_AND_FLAME, KHAZAD_DUM]);
        expect(basePlay.isExpansion).toBe(false);
        expect(basePlay.game).toBe(LOTR_LCG);
    });
});

describe('split plays by date and location', () => {
    it('should split plays by location', () => {
        const rawData = [NORM_ONE_PLAY_OF_RACE_AT_HOME(), NORM_ONE_PLAY_OF_GATHERING_STORM_ONLINE(), NORM_ONE_PLAY_OF_RACE_AT_HOME()];
        const split = splitPlaysByDateAndLocation(rawData);
        expect(split.length).toBe(2);
    });
});

function sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0);
}

function find(gameId: number, plays: WorkingNormalisedPlays[]): WorkingNormalisedPlays {
    return plays.filter(p => p.game === gameId || p.expansions.indexOf(gameId) >= 0)[0];
}

function findWithBaseGame(gameId: number, plays: WorkingNormalisedPlays[]): WorkingNormalisedPlays {
    return plays.filter(p => p.game === gameId)[0];
}

function findWithLocation(gameId: number, location: string, plays: WorkingNormalisedPlays[]): WorkingNormalisedPlays {
    return plays.filter(p => (p.game === gameId || p.expansions.indexOf(gameId) >= 0) && p.location === location)[0];
}

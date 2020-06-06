import {sumQuantities} from "../src/plays";
import {WorkingNormalisedPlays} from "../src/interfaces";
import * as bob from "../src/plays";

const ONE_PLAY_OF_GAME = {
    expansions: [], isExpansion: false, quantity: 1, game: 320, geek: 1, date: 1, month: 1, year: 2020
};
const TWO_PLAYS_OF_GAME = {
    expansions: [], isExpansion: false, quantity: 2, game: 320, geek: 1, date: 1, month: 1, year: 2020
};

test('bob', () => {
    console.log(bob);
});

describe('working normalised plays', () => {
    it('should sum quantities', () => {
        const src: WorkingNormalisedPlays[] = [ ONE_PLAY_OF_GAME, TWO_PLAYS_OF_GAME ];
        const summed = sumQuantities(src);
        expect(summed.quantity).toBe(3);
        expect(summed.game).toBe(320);
    })
});

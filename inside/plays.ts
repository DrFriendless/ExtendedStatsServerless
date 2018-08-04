import * as _ from "lodash";
import {NormalisedPlays, WorkingNormalisedPlays} from "./interfaces";
import {ExpansionData} from "./expansion-data";

function toWorkingPlay(expansionData: ExpansionData, play: NormalisedPlays): WorkingNormalisedPlays {
    return {
        quantity: play.quantity,
        game: play.game,
        geek: play.geek,
        date: play.date,
        month: play.month,
        year: play.year,
        isExpansion: expansionData.isExpansion(play.game),
        expansions: []
    } as WorkingNormalisedPlays;
}

// # def _inferExtraPlaysForADate(games, plays):
// #     import library
// #     from plays import Play
// #     result = []
// #     messages = []
// #     for play in plays:
// #         if play.game.expansion:
// #             for bgplay in plays:
// #                 if play is bgplay:
// #                     continue
// #                 exids = [ x.bggid for x in bgplay.expansions ]
// #                 if (bgplay.game.bggid in play.game.basegames or __intersect(play.game.basegames, exids)) and play.game not in bgplay.expansions:
// #                     nq = min(play.count, bgplay.count)
// #                     play.count = play.count - nq
// #                     bgplay.count = bgplay.count - nq
// #                     p = Play(bgplay.game, bgplay.expansions + [play.game] + play.expansions, bgplay.date, nq, bgplay.raters, bgplay.ratingsTotal,  "")
// #                     #messages.append(u"%s Added %d plays of %s to %s" % (p.date, nq, play.game.name, p.game.name))
// #                     newps = [p]
// #                     if play.count > 0:
// #                         newps.append(play)
// #                     if bgplay.count > 0:
// #                         newps.append(bgplay)
// #                     orig = len(plays)
// #                     others = [ op for op in plays if op is not play and op is not bgplay ]
// #                     messages.append(u"%s %s expands %s %d + %d <= %d" % (unicode(play.date), play.game.name.decode('utf-8'), bgplay.game.name.decode('utf-8'), len(newps), len(others), orig))
// #                     return others + newps, messages, True
// #             # no known basegame
// #             if len(play.game.basegames) == 1:
// #                 basegame = play.game.basegames[0]
// #                 if games.get(basegame) is None:
// #                     gs = getGames([basegame])
// #                     if gs.get(basegame) is None:
// #                         raise Exception("Never heard of game %s which is the base game of %s" % (str(basegame), play.game.name))
// #                     games[basegame] = gs[basegame]
// #                 p = Play(games[basegame], [play.game] + play.expansions, play.date, play.count, play.raters, play.ratingsTotal,  "")
// #                 others = [ op for op in plays if op is not play ]
// #                 #messages.append(u"%s Inferred a play of %s from %s, %s\nothers = %s\nplays = %s" % (play.date, games[basegame].name, play.game.name, str(p.expansions), str(others), str(plays)))
// #                 return others + [p], messages, True
// #             else:
// #                 messages.append("Can't figure out what %s expanded on %s: %s" % (play.game.name, play.date, library.gameNames(play.game.basegames, games)))
// #             messages.append("No idea about %s" % bgplay.game.name)
// #         result.append(play)
// #     return result, messages, False

function sumQuantities(plays: WorkingNormalisedPlays[]): WorkingNormalisedPlays {
    if (plays.length === 1) return plays[0];
    const total = plays.map(p => p.quantity).reduce((a,b) => a + b);
    plays[0].quantity = total;
    return plays[0];
}

function coalescePlays(initial: WorkingNormalisedPlays[]): WorkingNormalisedPlays[] {
    const byGame = _.groupBy(initial, wnp => wnp.game);
    return Object.values(byGame).map(sumQuantities);
}

// figure out the canonical list of plays for a single geek on a single date
export function inferExtraPlays(initialPlays: NormalisedPlays[], expansionData: ExpansionData): WorkingNormalisedPlays[] {
    let current = initialPlays.map(play => toWorkingPlay(expansionData, play));
    current = coalescePlays(current);
    let iterations = 0;
    while (iterations < 100) {
        iterations++;
        const newPlays = inferNewPlays(current, expansionData);
        if (newPlays == null) return current;
        current = newPlays;
    }
    console.log("Too many iterations");
    console.log(initialPlays[0]);
    return current;
}

function inferNewPlays(current: WorkingNormalisedPlays[], expansionData: ExpansionData): WorkingNormalisedPlays[] {
    const expansionPlays = current.filter(play => play.isExpansion);
    for (let expansionPlay of expansionPlays) {
        for (let basegamePlay of current) {
            if (Object.is(expansionPlay, basegamePlay)) continue;
            const couldExpand = expansionData.isBasegameOf(basegamePlay.game, expansionPlay.game) || expansionData.isAnyBasegameOf(basegamePlay.expansions, expansionPlay.game);
            if (couldExpand && basegamePlay.expansions.indexOf(expansionPlay.game) < 0) {
                // basegamePlay could have included expansionPlay as an expansion, so we're going to say that it did
                const newQuantity = Math.min(expansionPlay.quantity, basegamePlay.quantity);
                expansionPlay.quantity -= newQuantity;
                basegamePlay.quantity -= newQuantity;
                const newPlay = {
                    quantity: newQuantity,
                    game: basegamePlay.game,
                    geek: basegamePlay.geek,
                    date: basegamePlay.date,
                    month: basegamePlay.month,
                    year: basegamePlay.year,
                    isExpansion: basegamePlay.isExpansion,
                    expansions: _.flatten([expansionPlay.game, expansionPlay.expansions, basegamePlay.expansions])
                } as WorkingNormalisedPlays;
                console.log(newPlay);
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
            const newPlay = {
                quantity: expansionPlay.quantity,
                game: basegame,
                geek: expansionPlay.geek,
                date: expansionPlay.date,
                month: expansionPlay.month,
                year: expansionPlay.year,
                isExpansion: expansionData.isExpansion(basegame),
                expansions: [expansionPlay.game]
            } as WorkingNormalisedPlays;
            const newPlays = current.filter(p => !Object.is(p, expansionPlay));
            newPlays.push(newPlay);
            return newPlays;
        }
    }
    return null;
}

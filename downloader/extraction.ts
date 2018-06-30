import {ProcessUserResult, ProcessCollectionResult, CollectionGame, ProcessGameResult} from "./interfaces";
import {between} from "./library";
const xml2js = require('xml2js-es6-promise');

export function extractUserCollectionFromPage(geek: string, url: string, pageContent: string): Promise<ProcessCollectionResult> {
    console.log("extractUserCollectionFromPage from " + url);
    return xml2js(pageContent, {trim: true})
        .then(dom => {
            console.log("Finished parsing DOM");
            if (dom && dom.message) {
                console.log("BGG says come back later");
                throw new Error("BGG says come back later to get collection for " + geek);
            }
            if (!dom || !dom.items || !dom.items.item || dom.items.item.length == 0) {
                console.log("Found no games in collection");
                throw new Error("Found no games in collection for " + geek);
            }
            const items: [CollectionGame] = [];
            dom.items.item.forEach(item => {
                if (item.$.subtype != 'boardgame') {
                    console.log(item.$.subtype + " not a board game");
                } else {
                    const gameId = item.$.objectid;
                    // const name = item.name[0]._;
                    const stats = item.stats[0];
                    const status = item.status[0];
                    const gameItem: CollectionGame = { gameId: gameId };
                    if (stats) {
                        const rating = stats.rating;
                        if (rating && rating.length > 0) {
                            gameItem.rating = parseFloat(rating[0].$.value);
                        } else {
                            gameItem.rating = -1;
                        }
                        if (gameItem.rating == null || Number.isNaN(gameItem.rating)) gameItem.rating = -1;
                    }
                    if (status) {
                        gameItem.owned = status.$.own === '1';
                        gameItem.prevOwned = status.$.prevowned === '1';
                        gameItem.forTrade = status.$.fortrade === '1';
                        gameItem.want = status.$.want === '1';
                        gameItem.wantToPlay = status.$.wanttoplay === '1';
                        gameItem.wantToBuy = status.$.wanttobuy;
                        const onWishList =  status.$.wishlist === '1';
                        gameItem.wishListPriority = onWishList ? parseInt(status.$.wishlist) : 0;
                        gameItem.preordered = status.$.preordered === '1';
                    }
                    items.push(gameItem);
                }
            });
            console.log("" + items.length + " items");
            return { geek: geek, items: items };
        });
}

// TODO - update front page data
// import frontpage
// frontpage.updateFrontPageData(db, geek)
// return 1

// TODO - geek game tags
// db.execute("delete from geekgametags where geek = '%s'" % geek)
// try:
// tagsNode = gameNode.getElementsByTagName("tags")[0]
// tagNodes = tagsNode.getElementsByTagName("tag")
// for tagNode in tagNodes:
// tag = library.Row()
// tag.geek = geek
// tag.game = game.game
// tag.tag = library.getText(tagNode).encode('utf8')
// if tag.tag.startswith("own:"):
// continue
// db.saveRow(tag, "geekgametags", "geek = '%s' and game = %d" % (tag.geek, tag.game))
// except IndexError:
//     # no tags
// pass


export function extractUserDataFromPage(geek: string, url: string, pageContent: string): ProcessUserResult {
    const BEFORE_USER_IMAGE = "/images/user/";
    const BEFORE_COUNTRY = "/users?country=";
    const AFTER_USER_IMAGE = "/";
    const AFTER_COUNTRY = '"';

    let bggid = -1;
    let country = "";
    if (pageContent.indexOf(BEFORE_USER_IMAGE) >= 0) {
        const bggids = between(pageContent, BEFORE_USER_IMAGE, AFTER_USER_IMAGE);
        if (bggids) bggid = parseInt(bggids);
    }
    if (pageContent.indexOf(BEFORE_COUNTRY) >= 0) {
        country = between(pageContent, BEFORE_COUNTRY, AFTER_COUNTRY).replace("%20", " ");
    }
    const result: ProcessUserResult = {
        geek: geek,
        url: url,
        country: country,
        bggid: bggid
    };
    return result;
}

export function extractGameDataFromPage(bggid: number, url: string, pageContent: string): ProcessGameResult {
    return xml2js(pageContent, {trim: true})
        .then(dom => {
            if (!dom) {
                throw new Error("Found no game data for game " + bggid);
            }
            if (!dom || !dom.boardgames || dom.boardgames.boardgame.length == 0 || dom.boardgames.boardgame.error) {
                throw new NoSuchGameError(bggid);
            }
            const result: ProcessGameResult = {};
            dom.boardgames.boardgame.forEach(boardgame => {
                const names = boardgame.name;
                // TODO
                const expansions = boardgame.boardgameexpansion;
                const categories = boardgame.boardgamecategory;
                const mechanics = boardgame.boardgamemechanic;
                const designers = boardgame.boardgamedesigner;
                const subdomains = boardgame.boardgamesubdomain;
                const statistics = boardgame.statistics;
                const ratings = statistics[0].ratings;
                const ranks = ratings[0].ranks[0].rank;
                console.log(ratings);
                console.log(ranks);
                console.log(subdomains);
                console.log(boardgame);
                // [ { _: 'Dispatcher', '$': { primary: 'true', sortindex: '1' } } ]
                const name = names.filter(it => it.$.primary == 'true')[0]._;
                result.gameId = parseInt(boardgame.$.objectid);
                result.yearPublished = parseInt(boardgame.yearpublished[0]);
                result.minPlayers = parseInt(boardgame.minplayers[0]);
                result.maxPlayers = parseInt(boardgame.maxplayers[0]);
                result.playTime = parseInt(boardgame.playingtime[0]);
                result.usersRated = parseInt(ratings[0].usersrated);
                result.average = parseFloat(ratings[0].average);
                result.bayesAverage = parseFloat(ratings[0].bayesaverage);
                result.subdomain = subdomains ? subdomains[0]._ : "Unknown";
                result.usersTrading = parseInt(ratings[0].trading);
                result.usersWanting = parseInt(ratings[0].wanting);
                result.usersWishing = parseInt(ratings[0].wishing);
                result.usersOwned = parseInt(ratings[0].owned);
                result.usersRated = parseInt(ratings[0].usersrated);
                result.name = name;
                result.url = url;
            });
            console.log(result);
            return result;
        });
}

export class NoSuchGameError extends Error {
    constructor(private id: number) {
        super("No such game " + id);
    }

    public getId(): number {
        return this.id;
    }
}
import {ProcessUserResult, ProcessCollectionResult, CollectionGame, ProcessGameResult} from "./interfaces";
import {between} from "./library";
const xml2js = require('xml2js-es6-promise');

export function extractUserCollectionFromPage(geek: string, url: string, pageContent: string): ProcessCollectionResult {
    return xml2js(pageContent, {trim: true})
        .then(dom => {
            if (!dom || !dom.items || dom.items.item.length == 0) {
                throw new Error("Found no games in collection for " + geek);
            }
            const items = [];
            dom.items.item.forEach(item => {
                if (item.$.subtype != 'boardgame') {
                    console.log(item.$.subtype + " not a board game");
                } else {
                    const gameId = item.$.objectid;
                    // const name = item.name[0]._;
                    const stats = item.stats[0];
                    const status = item.status[0];
                    const gameItem = { gameId: gameId } as CollectionGame;
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
                    // console.log(gameItem);
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

// export interface ProcessGameResult {
//     gameId: number;
//     name: string;
//     average: number;
//     rank: number;
//     yearPublished: number;
//     minPlayers: number;
//     maxPlayers: number;
//     playTime: number;
//     usersRated: number;
//     usersTrading: number;
//     usersWanting: number;
//     usersWishing: number;
//     averageWeight: number;
//     bayesAverage: number;
//     stdDev: number;
//     median: number;
//     numComments: number;
//     expansion: number;
//     usersOwned: number;
//     subdomain: string;
// }
export function extractGameDataFromPage(bggid: number, url: string, pageContent: string): ProcessGameResult {
    const result = {};
    return xml2js(pageContent, {trim: true})
        .then(dom => {
            if (!dom) {
                throw new Error("Found no game data for game " + bggid);
            }
            console.log(result);
            return result;
        });
}

import { between, logError } from "./library.mjs";
import {
    CollectionGame,
    PlayData,
    ProcessCollectionResult, ProcessGameResult,
    ProcessUserResult, FileToProcess
} from "extstats-core";
import { parseStringPromise } from 'xml2js';

export async function extractUserCollectionFromPage(geek: string, url: string, pageContent: string): Promise<ProcessCollectionResult> {
    const dom = await parseStringPromise(pageContent, {trim: true});
    if (dom && dom.message) {
        console.log("BGG says come back later");
        throw new Error("BGG says come back later to get collection for " + geek);
    }
    if (!dom || !dom.items) {
        if (pageContent.includes("Collection exceeds maximum export size")) {
            await logError("Collection exceeds maximum export size for " + geek);
            throw new Error("Collection exceeds maximum export size for " + geek);
        }
        console.log("Found incorrect DOM");
        await logError("Found incorrect DOM for " + geek);
        throw new Error("Found incorrect DOM for " + geek);
    }
    if (!dom.items.item || dom.items.item.length === 0) {
        console.log("Found no games in collection");
        await logError("Found no games in collection for " + geek);
    }
    const items: CollectionGame[] = [];
    const byId: Record<string, Partial<CollectionGame>> = {};
    if (dom.items.item) {
        dom.items.item.forEach((item: any) => {
            if (item.$.subtype != 'boardgame') {
                console.log(item.$.subtype + " not a board game");
            } else {
                const gameId: string = item.$.objectid;
                // const name = item.name[0]._;
                const stats = item.stats[0];
                const status = item.status[0];
                const existingItem = byId[gameId];
                const existing = !!existingItem;
                const gameItem = existingItem || ({ gameId: gameId, rating: -1 } as unknown as CollectionGame);
                if (stats) {
                    const rating = stats.rating;
                    if (rating && rating.length > 0) {
                        const r = parseFloat(rating[0].$.value);
                        if (!Number.isNaN(r)) gameItem.rating = r;
                    }
                }
                if (status) {
                    gameItem.owned = gameItem.owned || (status.$.own === '1');
                    gameItem.prevOwned = gameItem.prevOwned || (status.$.prevowned === '1');
                    gameItem.forTrade = gameItem.forTrade || (status.$.fortrade === '1');
                    gameItem.want = gameItem.want || (status.$.want === '1');
                    gameItem.wantToPlay = gameItem.wantToPlay || (status.$.wanttoplay === '1');
                    gameItem.wantToBuy = gameItem.wantToBuy || (status.$.wanttobuy);
                    const onWishList = status.$.wishlist === '1';
                    gameItem.wishListPriority = gameItem.wishListPriority || (onWishList ? parseInt(status.$.wishlist) : 0);
                    gameItem.preordered = gameItem.preordered || (status.$.preordered === '1');
                }
                if (!existing) {
                    items.push(gameItem as CollectionGame);
                    byId[gameItem.gameId] = gameItem;
                }
            }
        });
    }

    // console.log(items);
    return { geek: geek, items: items };
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
    return { geek, url, country, bggid };
}

export async function extractGameDataFromPage(bggid: number, url: string, pageContent: string): Promise<ProcessGameResult> {
    const dom = await parseStringPromise(pageContent, {trim: true});
    if (!dom || !dom.boardgames || dom.boardgames.boardgame.length === 0) {
        throw new NoSuchGameError(bggid);
    }
    const result = {} as ProcessGameResult;
    for (const boardgame of dom.boardgames.boardgame) {
        const names = boardgame.name;
        // TODO
        // console.log(boardgame);
        if (boardgame.error) throw new NoSuchGameError(bggid);
        const expansions = boardgame.boardgameexpansion || [];
        const expIds = expansions.filter((row: any) => row.$.inbound != "true").map((row: any) => parseInt(row.$.objectid));
        const categories = boardgame.boardgamecategory;
        const mechanics = boardgame.boardgamemechanic;
        const designers = boardgame.boardgamedesigner;
        const publishers = boardgame.boardgamepublisher;
        const subdomains = boardgame.boardgamesubdomain;
        const statistics = boardgame.statistics;
        const ratings = statistics[0].ratings;
        const ranks = ratings[0].ranks[0].rank;
        let ranking = 0;
        if (ranks) {
            const bgRank = ranks.filter((r: any) => r.$.name = 'boardgame');
            if (bgRank.length > 0) {
                const rankingValue = bgRank[0].$.value;
                try {
                    ranking = parseInt(rankingValue);
                } catch (e) {
                }
            }
        }
        const name = names.filter((it: any) => it.$.primary == 'true')[0]._;
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
        result.averageWeight = parseFloat(ratings[0].averageweight);
        result.usersOwned = parseInt(ratings[0].owned);
        result.usersRated = parseInt(ratings[0].usersrated);
        result.name = name;
        result.url = url;
        result.categories = categories ? categories.map((c: any) => c._) : [];
        result.mechanics = mechanics ? mechanics.map((c: any) => c._) : [];
        result.designers = designers ? designers.map((c: any) => parseInt(c.$.objectid)) : [];
        result.publishers = publishers ? publishers.map((c: any) => parseInt(c.$.objectid)) : [];
        result.rank = ranking;
        result.expansions = expIds;
    }
    return result;
}

export class NoSuchGameError {
    constructor(private id: number) { }

    public getId(): number {
        return this.id;
    }
}

export async function processPlaysFile(fileContents: string, invocation: FileToProcess): Promise<{ count: number, plays: PlayData[] }> {
    const dom = await parseStringPromise(fileContents, {trim: true});
    const result: PlayData[] = [];
    if (!dom || !dom.plays || !dom.plays.play) {
        console.log("Plays not found");
        console.log(dom);
        await logError("Plays not found in " + invocation.url);
        return { count: -1, plays: result };
    }
    const playCount = parseInt(dom.plays.$.total);
    dom.plays.play.forEach((play: any) => {
        const date = play.$.date;
        const items = play.item;
        const quantity = play.$.quantity;
        const location = play.$.location;
        const gameid = parseInt(items[0].$.objectid);
        const raters = 0; // TODO
        const ratingsTotal = 0; // TODO
        result.push({ quantity, location, date, gameid, raters, ratingsTotal });
    });
    return { count: playCount, plays: result };
}

// TODO - get player ratings
// def processPlaysFile(filename, recorded):
// import xml.dom.minidom
// try:
// dom = xml.dom.minidom.parse(filename)
// except xml.parsers.expat.ExpatError, e:
// print "Error parsing XML in file %s" % filename, e
// return
// playElements = dom.getElementsByTagName("play")
// if len(playElements) == 0:
// print "no plays in %s" % filename
// return
// try:
// numEntries = int(dom.getElementsByTagName("plays")[0].getAttribute("total"))
// except ValueError:
//     numEntries = 1
// for pe in playElements:
// playerRecs = []
// date = pe.getAttribute("date")
// quantity = int(pe.getAttribute("quantity"))
// items = pe.getElementsByTagName("item")
// gameId = int(items[0].getAttribute("objectid"))
// location = pe.getAttribute("location")
// (raters, ratingsTotal) = getRatings(pe)
// playersNodes = pe.getElementsByTagName("players")
// if len(playersNodes):
// players = playersNodes[0].getElementsByTagName("player")
// for p in players:
// username = p.getAttribute("username")
// name = p.getAttribute("name")
// colour = p.getAttribute("color")
// if username == "":
// username = None
// if name == "":
// name = None
// if colour == "":
// colour = None
// if username is not None or name is not None or colour is not None:
//     playerRecs.append((username, name, colour))
// if quantity < 10000:
// recorded.add(date, (gameId, quantity, raters, ratingsTotal,  location, playerRecs))
// return numEntries

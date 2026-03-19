import {APIGatewayProxyEvent} from "aws-lambda";
import {findSystem, HttpResponse, isHttpResponse} from "./system.mjs";
import {DesignerResult} from "export";
import {getGeekId} from "./library.mjs";
import {makeIndex} from "extstats-core";

export async function getDesigners(event: APIGatewayProxyEvent): Promise<HttpResponse | DesignerResult[]> {
    const system = await findSystem("private");
    if (isHttpResponse(system)) return system;
    await system.incrementApiCounter();

    const geek = event.queryStringParameters.geek;
    if (!geek) {
        return {
            statusCode: 400,
            body: JSON.stringify("You must specify a 'geek' parameter")
        }
    }

    return await system.asyncReturnWithConnection(async conn => {
        const geekid = await getGeekId(conn, geek);
        // all designers that might be relevant
        const myDesignerSql = "select designer bggid, (count(game) + importance) score, name from game_designers gd, designers where gd.designer = designers.bggid and designers.boring = 0 and game in (select game from geekgames where geekid = ? union select game from plays_normalised where geek = ?) group by designer";
        const myDesignerData = await conn.query(myDesignerSql, [geekid, geekid]) as DesignerResult[];
        const designerIds = myDesignerData.map(row => row.bggid);
        const designerIndex = makeIndex(myDesignerData);
        const designerGamesSql = "select game bggid, designer from game_designers where designer in (?)";
        const designerGamesData = await conn.query(designerGamesSql, [designerIds]) as { bggid: number, designer: number }[];
        const designersForGames: Record<string, number[]> = {};
        designerGamesData.forEach(row => {
            const v = designersForGames[row.bggid.toString()] || [];
            v.push(row.designer);
            designersForGames[row.bggid.toString()] = v;
        });
        // add one point per play
        const playsSql = "select game bggid,sum(quantity) q from plays_normalised where geek = ? and expansion_play = 0 group by game";
        const playsData = await conn.query(playsSql, [geekid]) as { bggid: number, q: number }[];
        const playsIndex = makeIndex(playsData);
        console.log(JSON.stringify(playsIndex));
        playsData.forEach(row => {
            const g= designersForGames[row.bggid.toString()];
            if (g) {
                g.forEach(designer => {
                    const d = designerIndex[designer];
                    if (d) d.score += row.q;
                })
            }
        });
        // game ratings
        const ratingsSql = "select game bggid,(rating - 5) r from geekgames where geekid = ? and rating > 0";
        const ratingsData = await conn.query(ratingsSql, [geekid]) as { bggid: number, r: number }[];
        ratingsData.forEach(row => {
            const g= designersForGames[row.bggid.toString()];
            if (g) {
                g.forEach(designer => {
                    const d = designerIndex[designer];
                    if (d) d.score += row.r;
                })
            }
        });
        myDesignerData.sort((d1, d2) => d2.score - d1.score);
        const resultDesigners = (myDesignerData.length > 100) ? myDesignerData.slice(0, 100) : myDesignerData;
        const resultDesignerIds = resultDesigners.map(d => d.bggid);
        const resultGames: number[] = [];
        designerGamesData.forEach(row => {
           if (resultDesignerIds.indexOf(row.designer) >= 0 && resultGames.indexOf(row.bggid) < 0) {
               resultGames.push(row.bggid);
           }
        });
        // gather game data
        const gameSql = "select bggid, name, average bggRating, `rank` bggRanking from games where bggid in (?) and bggid not in (select expansion from expansions)";
        const gameData = await conn.query(gameSql, [resultGames]) as { bggid: number, name: string, bggRating: number, bggRanking: number }[];
        const gameDataIndex = makeIndex(gameData);
        const geekGameSql = "select game bggid, rating, owned, prevowned, wanttobuy wtb, wanttoplay wtp, want wit from geekgames where geekid = ? and game in (?)";
        const geekGameData = await conn.query(geekGameSql, [geekid, resultGames]) as { bggid: number, rating: number, owned: number, prevowned: number, wtb: number, wtp: number, wit: number }[];
        const geekGameDataIndex = makeIndex(geekGameData);
        resultGames.forEach(bggid => {
           const g = gameDataIndex[bggid];
           if (g) {
               const gg = geekGameDataIndex[bggid];
               const rgg = gg ? {
                   rating: gg.rating,
                   owned: gg.owned > 0,
                   prevOwned: gg.prevowned > 0,
                   wtb: gg.wtb > 0,
                   wtp: gg.wtp > 0,
                   wit: gg.wit > 0
               } : {
                   rating: -1,
                   owned: false,
                   prevOwned: false,
                   wtb: false,
                   wtp: false,
                   wit: false
               };
               const ds = designersForGames[bggid.toString()] || [];
               ds.forEach(d => {
                  const designer = designerIndex[d.toString()];
                  if (designer) {
                      const gs = designer.games || [];
                      gs.push({...g, ...rgg, plays: playsIndex[g.bggid]?.q || 0});
                      designer.games = gs;
                  }
               });
           }
        });
        return resultDesigners;
    });
}
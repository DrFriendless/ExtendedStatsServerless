import * as graphql from "graphql";
import { APIGatewayProxyEvent, Callback, Context } from "aws-lambda";
import { GraphQLInputObjectType, GraphQLObjectType } from "graphql";
import * as mysql from "promise-mysql";
import { GeekGame, GeekGameQueryResult, MultiGeekPlays } from "extstats-core";
import { doRetrieveGames } from "./mysql-rds";
import { asyncReturnWithConnection, getGeekIds } from "./library";
import { Expression, parse } from "./parser";
import { evaluateSimple } from "./selector";

const ListOfString = new graphql.GraphQLList(graphql.GraphQLString!);
const ListOfInt = new graphql.GraphQLList(graphql.GraphQLInt!);
const GameDataType = new graphql.GraphQLObjectType({
  name: "GameData",
  fields: {
    bggid: { type: graphql.GraphQLInt! },
    bggRanking: { type: graphql.GraphQLInt! },
    yearPublished: { type: graphql.GraphQLInt! },
    minPlayers: { type: graphql.GraphQLInt! },
    maxPlayers: { type: graphql.GraphQLInt! },
    playTime: { type: graphql.GraphQLInt! },
    name: { type: graphql.GraphQLString! },
    subdomain: { type: graphql.GraphQLString! },
    bggRating: { type: graphql.GraphQLFloat! },
    weight: { type: graphql.GraphQLFloat! },
    isExpansion: { type: graphql.GraphQLBoolean! }
  }
});
const GeekGameType = new GraphQLObjectType({
    name: "GeekGame",
    fields: {
      bggid: { type: graphql.GraphQLInt! },
      rating: { type: graphql.GraphQLFloat! },
      owned: { type: graphql.GraphQLBoolean! },
      wantToBuy: { type: graphql.GraphQLBoolean! },
      wantToPlay: { type: graphql.GraphQLBoolean! },
      preordered: { type: graphql.GraphQLBoolean! },
      prevOwned: { type: graphql.GraphQLBoolean! },
      lastPlay: { type: graphql.GraphQLInt! },
      firstPlay: { type: graphql.GraphQLInt! },
      daysSincePlayed: { type: graphql.GraphQLInt! },
      shouldPlayScore: { type: graphql.GraphQLFloat! },
      plays: { type: graphql.GraphQLInt! },
      lyPlays: { type: graphql.GraphQLInt! },
      years: { type: graphql.GraphQLInt! },
      months: { type: graphql.GraphQLInt! },
      lyMonths: { type: graphql.GraphQLInt! },
      expansion: { type: graphql.GraphQLBoolean! }
    }
  }
);
const PlaysWithDateType = new graphql.GraphQLObjectType({
  name: "PlaysWithDate",
  fields: {
    geek: { type: graphql.GraphQLString! },
    year: { type: graphql.GraphQLInt! },
    month: { type: graphql.GraphQLInt! },
    day: { type: graphql.GraphQLInt! },
    ymd: { type: graphql.GraphQLInt! },
    game: { type: graphql.GraphQLInt! },
    expansions: { type: ListOfInt },
    quantity: { type: graphql.GraphQLInt! }
  }
});
const VarBindingInputType = new GraphQLInputObjectType({
  name: "VarBinding",
  fields: {
    name: { type: graphql.GraphQLString! },
    value: { type: graphql.GraphQLString! }
  }
});
const MultiGeekPlaysType = new GraphQLObjectType({
  name: "MultiGeekPlays",
  fields: {
    geeks: { type: ListOfString },
    plays: { type: new graphql.GraphQLList(PlaysWithDateType!) },
    games: { type: new graphql.GraphQLList(GameDataType!) }
  }
});
export interface SelectorMetadata {
  game: number;
  colour?: string;
  owner?: string;
  player?: string;
  rater?: string;
}
const SelectorMetadataType = new GraphQLObjectType( {
  name: "SelectorMetadata",
  fields: {
    game: { type: graphql.GraphQLInt! },
    colour: { type: graphql.GraphQLString },
    owner: { type: graphql.GraphQLString },
    player: { type: graphql.GraphQLString },
    rater: { type: graphql.GraphQLString }
  }
});
const GeekGamesType = new GraphQLObjectType({
  name: "GeekGames",
  fields: {
    games: { type: new graphql.GraphQLList(GameDataType!) },
    geekGames: { type: new graphql.GraphQLList(GeekGameType!) },
    metadata: { type: new graphql.GraphQLList(SelectorMetadataType!) }
  }
});

const schema = new graphql.GraphQLSchema({
  query: new graphql.GraphQLObjectType({
    name: "RetrieveQuery",
    fields: {
      plays: {
        args: {
          geeks: { name: "geeks", type: ListOfString },
          first: { name: "first", type: graphql.GraphQLBoolean },
          startYMD: { name: "startYMD", type: graphql.GraphQLInt },
          endYMD: { name: "endYMD", type: graphql.GraphQLInt }
        },
        type: MultiGeekPlaysType,
        resolve: async (parent, args) =>
          await asyncReturnWithConnection(async conn =>
            await playsQueryForRetrieve(conn, args.geeks, !!args.first, args.startYMD || 0, args.endYMD || 30000000)
          )
      },
      geekgames: {
        args: {
          selector: { name: "selector", type: graphql.GraphQLString },
          vars: { name: "vars", type: new graphql.GraphQLList(VarBindingInputType!) }
        },
        type: GeekGamesType,
        resolve: async (parent, args) =>
          await asyncReturnWithConnection(async conn =>
            await geekGamesQueryForRetrieve(conn, args.selector, args.vars)
          )
      }
    }
  })
});

type RetrievePlay = {
  game: number;
  quantity: number;
  ymd: number;
  year: number;
  month: number;
  date: number;
  geek: string;
  expansions: number[];
};
interface VarBinding {
  name: string;
  value: string;
}

async function geekGamesQueryForRetrieve(conn: mysql.Connection, selector: string, varBindings: VarBinding[]) {
  const expr: Expression = parse(selector);
  const vars: Record<string, string> = {};
  for (const vb of varBindings) vars[vb.name] = vb.value;
  const evalResult: GeekGameQueryResult = await evaluateSimple(conn, expr, vars);
  await addLastPlayOfGamesForGeek(conn, evalResult.geekGames);
  const gids = evalResult.geekGames.map(gg => gg.bggid);
  const games = await doRetrieveGames(conn, gids);
  return { ...evalResult, games };
}

async function addLastPlayOfGamesForGeek(conn: mysql.Connection, geekGames: GeekGame[]) {
  if (geekGames.length === 0) return;
  const geekid = geekGames[0]['geekid'];
  const bggids = geekGames.map(gg => gg.bggid);
  const index: Record<string, GeekGame> = {};
  geekGames.forEach(gg => {
    index[gg.bggid] = gg;
    gg['shouldPlayScore'] = 0;
    gg['plays'] = 0;
    gg['years'] = 0;
    gg['months'] = 0;
    gg['expansion'] = false;
    gg['lyPlays'] = 0;
    gg['lyMonths'] = 0;
  });
  const sql = "select game, sum(quantity) q, max(expansion_play) x, max(year * 10000 + month * 100 + date) lastPlayed, min(year * 10000 + month * 100 + date) firstPlayed, count(distinct year) years, count(distinct year*100+month) months from plays_normalised where geek = ? and game in (?) group by game";
  const rows: object[] = await conn.query(sql, [geekid, bggids]);
  rows.forEach(row => {
    index[row['game']]['lastPlay'] = row['lastPlayed'];
    index[row['game']]['firstPlay'] = row['firstPlayed'];
    index[row['game']]['plays'] = row['q'];
    index[row['game']]['years'] = row['years'];
    index[row['game']]['months'] = row['months'];
    index[row['game']]['expansion'] = row['x'];
  });

  const now = new Date();
  const today = now.getFullYear() * 10000 + now.getMonth() * 100 + now.getDate();
  const playsSql = "select game, sum(quantity) q, count(month) months from plays_normalised where geek = ? and ? - (year * 10000 + month * 100 + date) < 10000  and game in (?) group by game";
  const lyRows: object[] = await conn.query(playsSql, [geekid, today, bggids]);
  lyRows.forEach(lyRow => {
    index[lyRow['game']]['lyPlays'] = lyRow['q'];
    index[lyRow['game']]['lyMonths'] = lyRow['months'];
  });

  geekGames.forEach(gg => {
    if (gg['lastPlay']) {
      const lp = ymdToDate(gg['lastPlay']);
      const daysSince = Math.round((now.valueOf() - lp.valueOf()) / 86400000);
      if (gg.rating > 0) gg['shouldPlayScore'] = Math.pow(gg.rating, 4) * daysSince;
      gg['daysSincePlayed'] = daysSince;
    }
  });
}

function ymdToDate(ymd: number): Date {
  const y = Math.floor(ymd / 10000);
  const d = ymd % 100;
  const m = Math.floor(ymd / 100) % 100;
  return new Date(y, m - 1, d);
}

async function playsQueryForRetrieve(conn: mysql.Connection, geeks: string[], first: boolean, startInc: number, endExc: number) {
  const geekNameIds: { [id: number]: string } = await getGeekIds(conn, geeks);
  if (Object.values(geekNameIds).length === 0) {
    return { geeks: [], plays: {}, collection: [], games: [] };
  }
  let where = "geek in (?)";
  const args: any[] = [ Object.keys(geekNameIds).map(s => parseInt(s)) ];
  if (Object.keys(geekNameIds).length === 1) {
    where = "geek = ?";
    args[0] = parseInt(Object.keys(geekNameIds)[0]);
  }
  if (first) where += " order by ymd asc";
  const playsSql = "select (year * 10000 + month * 100 + date) ymd, id, game, geek, quantity, year, month, date, expansion_play, baseplay from plays_normalised where " + where;
  const playsResult = await conn.query(playsSql, args);
  const expPlays: object[] = [];
  const basePlays: RetrievePlay[] = [];
  const playsById: Record<number, RetrievePlay> = {};
  const firstKeys: string[] = [];
  for (const row of playsResult) {
    if (first) {
      const firstKey = `${row.game}-${row.geek}`;
      if (firstKeys.indexOf(firstKey) >= 0) continue;
      firstKeys.push(firstKey);
    }
    if (row.ymd < startInc || row.ymd >= endExc) continue;
    if (row["expansion_play"]) {
      expPlays.push(row);
    } else {
      const username = geekNameIds[row.geek];
      if (!username) {
        console.log("No user found for " + row.geek);
        continue;
      }
      const pwd: RetrievePlay = { game: row.game, quantity: row.quantity, ymd: row.ymd, year: row.year, month: row.month, date: row.date,
        geek: username, expansions: [] };
      basePlays.push(pwd);
      playsById[row.id] = pwd;
    }
  }
  for (const ep of expPlays) {
    const pwd = playsById[ep["baseplay"]];
    if (!pwd) {
      console.log("No base play " + ep["baseplay"] + " found");
      continue;
    }
    pwd.expansions.push(ep["game"]);
  }
  const gameIds: number[] = [];
  for (const p of basePlays) {
    if (gameIds.indexOf(p.game) < 0) gameIds.push(p.game);
    for (const e of p.expansions) {
      if (gameIds.indexOf(e) < 0) gameIds.push(e);
    }
  }
  const games = await doRetrieveGames(conn, gameIds);
  return { geeks: Object.values(geekNameIds), plays: basePlays, games };
}

export async function retrieve(event: APIGatewayProxyEvent, context: Context, callback: Callback) {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    const headers = {
      "Access-Control-Allow-Origin": "*"
    };
    // handle empty query for CORS
    const result = event.queryStringParameters.query ? await graphql.graphql(schema, event.queryStringParameters.query) : {};
    callback(undefined, {statusCode: 200, headers, body: JSON.stringify(result)});
  } catch (err) {
    console.log(err);
    callback(err);
  }
}

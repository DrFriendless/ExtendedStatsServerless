import * as graphql from "graphql";
import { APIGatewayProxyEvent, Callback, Context } from "aws-lambda";
import { GraphQLObjectType } from "graphql";
import * as mysql from "promise-mysql";
import { MultiGeekPlays } from "extstats-core";
import { doRetrieveGames } from "./mysql-rds";
import { asyncReturnWithConnection, getGeekIds } from "./library";

const ListOfString = new graphql.GraphQLList(graphql.GraphQLString!);
const ListOfInt = new graphql.GraphQLList(graphql.GraphQLInt!);

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
        type: new GraphQLObjectType({
          name: "MultiGeekPlays",
          fields: {
            geeks: { type: ListOfString },
            plays: {
              type: new graphql.GraphQLList(new graphql.GraphQLObjectType({
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
              }))!
            },
            games: {
              type: new graphql.GraphQLList(new graphql.GraphQLObjectType({
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
              }))!
            }
          }
        }),
        resolve: async (parent, args) =>
          await asyncReturnWithConnection(async conn =>
            await playsQueryForRetrieve(conn, args.geeks, !!args.first, args.startYMD || 0, args.endYMD || 30000000)
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
  console.log(event);
  try {
    const result = await graphql.graphql(schema, event.queryStringParameters.query);
    callback(undefined, {statusCode: 200, body: JSON.stringify(result)});
  } catch (err) {
    console.log(err);
    callback(err);
  }
}
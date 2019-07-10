import * as graphql from "graphql";
import { APIGatewayProxyEvent, Callback, Context } from "aws-lambda";
import { GraphQLObjectType } from "graphql";
import * as mysql from "promise-mysql";
import { MultiGeekPlays } from "extstats-core";
import { doRetrieveGames } from "./mysql-rds";
import { asyncReturnWithConnection, getGeekIds } from "./library";

const schema = new graphql.GraphQLSchema({
  query: new graphql.GraphQLObjectType({
    name: "RetrieveQuery",
    fields: {
      // the query has a field called 'greeting'
      greeting: {
        // we need to know the user's name to greet them
        args: { firstName: { name: "firstName", type: new graphql.GraphQLNonNull(graphql.GraphQLString) } },
        // the greeting message is a string
        type: graphql.GraphQLString,
        resolve: async (parent, args) => await getGreeting(args.firstName)
      },
      getPlays: {
        args: {
          geeks: { name: "geeks", type: new graphql.GraphQLList(graphql.GraphQLString)! },
          startYMD: { name: "startYMD", type: graphql.GraphQLInt },
          endYMD: { name: "endYMD", type: graphql.GraphQLInt }
        },
        type: new GraphQLObjectType({
          name: "MultiGeekPlays",
          fields: {
            geeks: { type: new graphql.GraphQLList(graphql.GraphQLString)! },
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
                  expansions: { type: new graphql.GraphQLList(graphql.GraphQLInt) },
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
            await playsQueryForRetrieve(conn, args.geeks, true)
          )
      }
    }
  })
});


export async function getGreeting(firstName: string): Promise<string> {
  return `Hello ${firstName}`;
}

async function playsQueryForRetrieve(conn: mysql.Connection, geeks: string[], first: boolean) {
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
  const expPlays = [];
  const basePlays: object[] = [];
  const playsById = {};
  const gameIds: number[] = [];
  const firstKeys: string[] = [];
  for (const row of playsResult) {
    if (gameIds.indexOf(row.game) < 0) gameIds.push(row.game);
    if (first) {
      const firstKey = `${row.game}-${row.geek}`;
      if (firstKeys.indexOf(firstKey) >= 0) continue;
      firstKeys.push(firstKey);
    }
    if (row["expansion_play"]) {
      expPlays.push(row);
    } else {
      const pwd: object = { game: row.game, quantity: row.quantity };
      pwd['ymd'] = row.ymd;
      pwd['year'] = row.year;
      pwd['month'] = row.month;
      pwd['date'] = row.date;
      const username = geekNameIds[row.geek];
      if (!username) {
        console.log("No user found for " + row.geek);
        continue;
      }
      pwd['geek'] = username;
      basePlays.push(pwd);
      playsById[row.id] = pwd;
    }
  }
  for (const ep of expPlays) {
    const pwd = playsById[ep.baseplay];
    if (!pwd) {
      console.log("No base play " + ep.baseplay + " found");
      continue;
    }
    if (!pwd.expansions) pwd.expansions = [];
    pwd.expansions.push(ep.game);
  }
  const games = await doRetrieveGames(conn, gameIds);
  return { geeks: Object.values(geekNameIds), plays: basePlays, collection: [], games };
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
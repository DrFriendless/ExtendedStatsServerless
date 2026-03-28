# Extstats API

## Data Types

A *selector* is an expression which returns a list of games.
It has a function symbol, and possible arguments.
As there are a lot of games there is no selector for all games, and that is generally not possible.
However there are ways to combine selectors to produce any set of games relevant to user collections.
There are also selectors which implement feature functionality by executing an algorithm to select games.

A *graph query* is a GraphQL query expression sent to the retrieve method which selects some data and returns some subset of it.
Often a graph query can take a selector as a parameter.
If the selector is "owned by Friendless", the query will first retrieve the set of games owned by BGG user "Friendless" (that's me).
Then for those games, the data returned will depend on the fields specified in the GraphQL query.
* a 'game' is data about a game independent of any particular geek, e.g. its name
* a 'geekgame' is data about a game related to a particular user, e.g. the rating the user gave that game.
* a 'play' is data about a play by a geek of a game, with related data like the date and the location.

So for example, the selector might be "owned by jmdsplotter", 
and the query might be for the name of the game and the rating of that game by Friendless.
So the API would find games owned by jmdsplotter, and return their name and how Friendless rates them.
This gives the feature pages quite a bit of flexibility in what data they can ask for.

## Selectors

## Users

## Comments API

## HOW TO DEPLOY

./build.sh && ./deploy.sh
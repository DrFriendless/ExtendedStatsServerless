# ExtendedStatsServerless

This is a rewrite of Extended Stats in the cloud, using:

 * Serverless framework
 * AWS Lambda, RDS, API Gateway, CloudWatch, CloudFormation, S3, Route 53, and Certificate Manager
 * UI components in Angular 6/7 etc
 * Lambdas written in Node.js.

The site is running at https://extstats.drfriendless.com.

Extended Stats is a project to download data about the relationship between board games and board game geeks from boardgamegeek.com.
The information available includes ratings for games and when those games are played.
This project draws graphs and does other analyses to try help geeks understand their obsession with the hobby, and most
importantly which game to buy next.

The original version was written in Python using Django running against a MySQL database.
For more information on why the decision was made to rewrite, see here: http://blog.drfriendless.com/2018/07/07/why-rewrite/

The system is architected as 5 Cloud Formation stacks, as described below.

<img src="https://www.drfriendless.com/img/Extended%20Stats%20Serverless%20Architecture.png"/>

## Downloader

The Downloader stack is a set of lambdas which download data from boardgamegeek.com, parse it, and send that data to the Inside stack.
At the moment, 3 of the lambdas are invoked by CloudWatch periodically to trigger other processing.

## Inside

The Inside stack is a set of lambdas which run inside the Virtual Private Cloud.
These lambdas receive data from the downloader and write it to the database.
They also perform some preprocessing on the data so that it's stored more efficiently for the retrieval and display functions.

## API

The API stack implements calls which the Client components use to retrieve data for display.
This stack is a set of lambdas running behind an API Gateway.
This is http://api.drfriendless.com.

## Client

The Client stack is JavaScript and HTML components hosted on S3.
The JavaScript is currently Angular components, as that's what I know, but other technologies could be used.
This is https://extstats.drfriendless.com.

## WWW

The WWW stack is a very tiny stack which implements https://www.drfriendless.com by hosting on S3.
This site isn't used for much, except as a signpost to more useful parts of the site.

# ExtendedStatsServerless
Extended Stats using the Serverless framework.

So far I've tried rolling my own framework using maven, which made me hate maven even more.
Then I tried using AWS CodeStar but found that it documents everything except the deployment model of the application,
in that you might be trying to create 3 lambdas with a zip file each, and a bunch of CloudFormation stuff, but the buildspec
specifies that the artifact is a zip.
Excuse me, I just deployed a cloud application, what the fuck does a ZIP have to do with it?
Is it one zip for all the lambdas? Who knows.

So I'm trying serverless to see whether it's better suited to building a cloud application. 
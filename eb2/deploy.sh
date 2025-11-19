#!/usr/bin/env bash
cp -R src/* staging
cp .env.production staging/.env
echo Copying artifacts to eb2 server
scp -i ~/.ssh/extstats-express.pem staging/* ec2-user@eb2.drfriendless.com:/opt/express
scp -i ~/.ssh/extstats-express.pem staging/.env ec2-user@eb2.drfriendless.com:/opt/express/.env
date
echo Done
echo Now ssh into eb2, cd /opt/express, and do sudo ./release.sh
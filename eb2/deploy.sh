#!/usr/bin/env bash
cp -R src/* staging
cp .env.production staging/.env
scp -i ~/.ssh/extstats-express.pem staging/* ec2-user@eb2.drfriendless.com:/opt/express
scp -i ~/.ssh/extstats-express.pem staging/.env ec2-user@eb2.drfriendless.com:/opt/express/.env


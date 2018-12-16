#!/usr/bin/env bash
scp -i ~/.ssh/extstats-express.pem extstats-express.zip ubuntu@eb2.drfriendless.com:/opt/express
scp -i ~/.ssh/extstats-express.pem unpackage.sh ubuntu@eb2.drfriendless.com:/opt/express
scp -i ~/.ssh/extstats-express.pem .env.production ubuntu@eb2.drfriendless.com:/opt/express/.env

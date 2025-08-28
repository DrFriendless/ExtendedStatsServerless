#!/usr/bin/env bash
cd /opt/express
pm2 stop express insideq

# express
pm2 stop express
rm -rf express
mkdir express
cp extstats-express.zip express
cd express
unzip -q -n extstats-express.zip
cd ..

# insideq
pm2 stop insideq
rm -rf insideq
mkdir insideq
cp inside-queue.zip insideq
cd insideq
unzip -q -n inside-queue.zip
cd ..

pm2 start pm2.config.js -u root
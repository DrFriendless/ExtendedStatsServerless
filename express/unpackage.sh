#!/usr/bin/env bash
cd /opt/express
sudo pm2 stop server
unzip -o extstats-express.zip
sudo pm2 start dist/server.js -u root

#!/usr/bin/env bash
cd /opt/express
sudo pm2 stop server
unzip -o inside-queue.zip
sudo pm2 start dist/main.mjs -u root

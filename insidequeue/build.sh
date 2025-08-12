#!/usr/bin/env bash
npm run build
zip -r inside-queue.zip dist node_modules
echo Now you should probably do ./deploy.sh
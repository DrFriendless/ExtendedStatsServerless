#!/usr/bin/env bash
npm run build
zip -q -r extstats-express.zip dist node_modules
echo Now you should probably do ./deploy.sh
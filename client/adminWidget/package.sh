#!/usr/bin/env bash

npm run build
mkdir -p ../static/adminWidget
cp ./dist/adminWidget/*.js ../static/adminWidget/
cp ./dist/adminWidget/styles.css ../static/adminWidget/styles.css

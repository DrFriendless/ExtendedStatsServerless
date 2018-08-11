#!/usr/bin/env bash

npm run buildprod
mkdir -p ../static/userWidget
cp ./dist/userWidget/*.js ../static/userWidget/
cp ./dist/userWidget/styles.css ../static/userWidget/styles.css

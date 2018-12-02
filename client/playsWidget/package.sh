#!/usr/bin/env bash

npm run buildprod

mkdir -p ../static/playsWidget
cp ./dist/playsWidget/*.js ../static/playsWidget/
cp ./dist/playsWidget/styles.css ../static/playsWidget/styles.css

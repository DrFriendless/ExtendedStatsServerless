#!/usr/bin/env bash

npm run buildprod
mkdir -p ../static/favouritesWidget
cp ./dist/favouritesWidget/*.js ../static/favouritesWidget/
cp ./dist/favouritesWidget/styles.css ../static/favouritesWidget/styles.css

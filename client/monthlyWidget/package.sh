#!/usr/bin/env bash

npm run buildprod

mkdir -p ../static/monthlyWidget
cp ./dist/monthlyWidget/*.js ../static/monthlyWidget/
cp ./dist/monthlyWidget/styles.css ../static/monthlyWidget/styles.css

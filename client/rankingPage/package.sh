#!/usr/bin/env bash

npm run buildprod

mkdir -p ../static/rankingTable
cp ./dist/rankingPage/*.js ../static/rankingTable/
cp ./dist/rankingPage/styles.css ../static/rankingTable/styles.css

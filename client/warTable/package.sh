#!/usr/bin/env bash

npm run buildprod

mkdir -p ../static/warTable
cp ./dist/warTable/*.js ../static/warTable/
cp ./dist/warTable/styles.css ../static/warTable/styles.css

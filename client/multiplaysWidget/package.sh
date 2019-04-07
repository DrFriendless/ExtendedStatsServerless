#!/usr/bin/env bash

npm run buildprod

mkdir -p ../static/multiplaysWidget
cp ./dist/multiplaysWidget/*.js ../static/multiplaysWidget/
cp ./dist/multiplaysWidget/styles.css ../static/multiplaysWidget/styles.css

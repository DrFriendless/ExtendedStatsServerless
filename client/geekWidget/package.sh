#!/usr/bin/env bash

npm run buildprod

mkdir -p ../static/geekWidget
cp ./dist/geekWidget/*.js ../static/geekWidget/
cp ./dist/geekWidget/styles.css ../static/geekWidget/styles.css

#!/usr/bin/env bash

npm run buildprod
mkdir -p ../static/selectorTest
cp ./dist/selectorTest/*.js ../static/selectorTest/
cp ./dist/selectorTest/styles.css ../static/selectorTest/styles.css

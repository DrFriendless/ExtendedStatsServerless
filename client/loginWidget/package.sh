#!/usr/bin/env bash

npm run buildprod
mkdir -p ../static/loginWidget
cp ./dist/loginWidget/*.js ../static/loginWidget/
cp ./dist/loginWidget/styles.css ../static/loginWidget/styles.css

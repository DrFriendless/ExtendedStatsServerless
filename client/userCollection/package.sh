#!/usr/bin/env bash

npm run buildprod
mkdir -p ../static/userCollection
cp ./dist/userCollection/*.js ../static/userCollection/
cp ./dist/userCollection/styles.css ../static/userCollection/styles.css

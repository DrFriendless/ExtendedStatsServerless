#!/usr/bin/env bash

npm run buildprod

mkdir -p ../static/ownedCollection
cp ./dist/ownedCollection/*.js ../static/ownedCollection/
cp ./dist/ownedCollection/styles.css ../static/ownedCollection/styles.css

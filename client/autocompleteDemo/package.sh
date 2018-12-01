#!/usr/bin/env bash

npm run build
mkdir -p ../static/autocompleteDemo
cp ./dist/autocompleteDemo/*.js ../static/autocompleteDemo/
cp iframe.html ../static/autocomplete-demo.html

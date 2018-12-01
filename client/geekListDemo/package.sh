#!/usr/bin/env bash

npm run build
mkdir -p ../static/geekListDemo
cp ./dist/geekListDemo/*.js ../static/geekListDemo/
cp iframe.html ../static/geeklist-demo.html

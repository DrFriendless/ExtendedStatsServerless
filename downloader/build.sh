#!/usr/bin/env bash
npm run build
rm downloader.zip
zip -q downloader.zip -j dist/*
zip -q downloader.zip -r node_modules/@aws*
zip -q downloader.zip -r node_modules/@smithy
zip -q downloader.zip -r node_modules/extstats-*
zip -q downloader.zip -r node_modules/fast-xml-parser
zip -q downloader.zip -r node_modules/lodash
zip -q downloader.zip -r node_modules/sax
zip -q downloader.zip -r node_modules/tslib
zip -q downloader.zip -r node_modules/xmlbuilder
zip -q downloader.zip -r node_modules/xml2js*
echo Now you should probably do ./deploy.sh
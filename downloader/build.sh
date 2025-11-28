#!/usr/bin/env bash
rm downloader.zip
npm run build
success=$?
if [ $success -eq 0 ]; then
    zip -q downloader.zip -j dist/*
    zip -q downloader.zip -r node_modules/@aws*
    zip -q downloader.zip -r node_modules/@smithy
    zip -q downloader.zip -r node_modules/extstats-*
    zip -q downloader.zip -r node_modules/fast-xml-parser
    zip -q downloader.zip -r node_modules/lodash-es
    zip -q downloader.zip -r node_modules/sax
    zip -q downloader.zip -r node_modules/strnum
    zip -q downloader.zip -r node_modules/tslib
    zip -q downloader.zip -r node_modules/xmlbuilder
    zip -q downloader.zip -r node_modules/xml2js*
    echo Now you should probably do ./deploy.sh
else
    echo Build failed, not proceeding.
fi
exit $success
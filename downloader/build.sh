#!/usr/bin/env bash
rm downloader.zip
npm run build
success=$?
if [ $success -eq 0 ]; then
    zip -q downloader.zip -j dist/*
    zip -q downloader.zip -r node_modules/@aws/*
    zip -q downloader.zip -r node_modules/@smithy
    zip -q downloader.zip -r node_modules/extstats-*
    zip -q downloader.zip -r node_modules/fast-xml-parser
    zip -q downloader.zip -r node_modules/lodash-es
    zip -q downloader.zip -r node_modules/sax
    zip -q downloader.zip -r node_modules/strnum
    zip -q downloader.zip -r node_modules/tslib
    zip -q downloader.zip -r node_modules/xmlbuilder
    zip -q downloader.zip -r node_modules/xml2js*
    zip -q downloader.zip -r node_modules/promise-mysql
    zip -q downloader.zip -r node_modules/mysql
    zip -q downloader.zip -r node_modules/bluebird
    zip -q downloader.zip -r node_modules/bignumber.js
    zip -q downloader.zip -r node_modules/safe-buffer
    zip -q downloader.zip -r node_modules/readable-stream
    zip -q downloader.zip -r node_modules/process-nextick-args
    zip -q downloader.zip -r node_modules/isarray
    zip -q downloader.zip -r node_modules/core-util-is
    zip -q downloader.zip -r node_modules/inherits
    zip -q downloader.zip -r node_modules/util-deprecate
    zip -q downloader.zip -r node_modules/sqlstring
    echo Now you should probably do ./deploy.sh
else
    echo Build failed, not proceeding.
fi
exit $success
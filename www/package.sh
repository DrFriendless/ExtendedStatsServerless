#!/usr/bin/env bash

mkdir -p static/img
cp img/*.* static/img

cp src/*.txt static
for F in src/*.mustache
    do
    FILENAME=`basename ${F}`
    FILENAME=${FILENAME%%.*}
    mustache values.json -p src/partials/adsbygoogle.mustache -p src/partials/gtmbody.mustache -p src/partials/gtmhead.mustache ${F} >static/${FILENAME}.html
    done


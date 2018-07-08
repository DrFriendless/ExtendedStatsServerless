#!/usr/bin/env bash

cp src/*.css static
for F in src/*.mustache
    do
    FILENAME=`basename ${F}`
    FILENAME=${FILENAME%%.*}
    mustache -p src/partials/*.mustache values.json ${F} >static/${FILENAME}.html
    done


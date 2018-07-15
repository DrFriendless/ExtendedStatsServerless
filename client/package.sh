#!/usr/bin/env bash

cp src/*.css static
for F in src/*.mustache
    do
    FILENAME=`basename ${F}`
    FILENAME=${FILENAME%%.*}
    mustache values.json -p src/partials/*.mustache ${F} >static/${FILENAME}.html
    done


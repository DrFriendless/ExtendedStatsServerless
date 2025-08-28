#!/usr/bin/env bash

mkdir -p static/img
cp img/*.* static/img

cp src/*.txt static
for F in src/*.mustache
    do
    FILENAME=`basename ${F}`
    FILENAME=${FILENAME%%.*}
    mustache values.json ${F} >static/${FILENAME}.html
    done


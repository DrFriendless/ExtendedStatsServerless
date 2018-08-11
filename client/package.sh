#!/usr/bin/env bash

mkdir -p static
cp src/*.txt static
cp src/*.css static
for F in src/*.mustache
    do
    FILENAME=`basename ${F}`
    FILENAME=${FILENAME%%.*}
    mustache values.json -p src/partials/adsbygoogle.mustache -p src/partials/loginbutton.mustache -p src/partials/gtmbody.mustache -p src/partials/windowhack.mustache -p src/partials/loginwidget.mustache -p src/partials/navbar.mustache -p src/partials/gtmhead.mustache -p src/partials/infrastructure.mustache ${F} >static/${FILENAME}.html
    done


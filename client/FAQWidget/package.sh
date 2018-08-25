#!/usr/bin/env bash

npm run buildprod
mkdir -p ../static/FAQWidget
cp ./dist/FAQWidget/*.js ../static/FAQWidget/
cp ./dist/FAQWidget/styles.css ../static/FAQWidget/styles.css

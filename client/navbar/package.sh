#! /bin/sh

npm run-script build && webpack --config webpack.config.js --mode=development && cp dist/navbar.* ../static
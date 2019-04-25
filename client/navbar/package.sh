#! /bin/sh

npm run-script build && webpack --config webpack.config.js && cp dist/build/static/js/bundle.min.js ../static/navbar.js
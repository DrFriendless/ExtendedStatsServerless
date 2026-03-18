#!/usr/bin/env bash
rm api.zip
rm tsconfig.tsbuildinfo
rm -rf dist/*
cd export
./build.sh
success=$?
cd ..
if [ $success -eq 0 ]; then
    echo Successfully built export lib
else
    echo Build failed, not proceeding.
    exit 1
fi
tsc --build
success=$?
if [ $success -eq 0 ]; then
    zip -q api.zip -j dist/*
    zip -q api.zip -r node_modules/*
    echo Successfully build lambda code
    echo Now you should probably do ./deploy.sh
else
    echo Build failed, not proceeding.
    exit 2
fi
exit $success
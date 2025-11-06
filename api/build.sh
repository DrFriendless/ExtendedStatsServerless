#!/usr/bin/env bash
rm api.zip
npm run build
success=$?
if [ $success -eq 0 ]; then
    zip -q api.zip -j dist/*
    zip -q api.zip -r node_modules/*
    echo Now you should probably do ./deploy.sh
else
    echo Build failed, not proceeding.
fi
exit $success
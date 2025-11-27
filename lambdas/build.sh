#!/usr/bin/env bash
rm misc.zip
npm run build
success=$?
if [ $success -eq 0 ]; then
    zip -q misc.zip -j dist/*
    zip -q misc.zip -r node_modules/*
    echo Now you should probably do ./deploy.sh
else
    echo Build failed, not proceeding.
fi
exit $success
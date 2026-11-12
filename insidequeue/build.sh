#!/usr/bin/env bash
npm run build
success=$?
if [ $success -eq 0 ]; then
    zip -q -r inside-queue.zip dist node_modules
    echo Now you should probably do ./deploy.sh
else
    echo Build failed, not proceeding.
fi
exit $success
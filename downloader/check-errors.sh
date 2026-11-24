#!/usr/bin/env bash
# written by Claude.
# check-errors.sh: search the last hour of downloader logs for "Error"
set -euo pipefail

REGION="ap-southeast-2"
PROFILE="drfriendless"
HOURS="${1:-1}"                        # optional: hours to look back, default 1
END=$(date +%s)
START=$((END - HOURS * 3600))

# Log groups to search. Add or remove as needed.
LOG_GROUPS=(
  "/aws/lambda/downloader_insideStartTasks"
  "/aws/lambda/downloader_prehandle"
  "/aws/lambda/downloader_processPlayedYears"
  "/aws/lambda/downloader_completeProcessUser"
  "/aws/lambda/downloader_completeProcessDesigner"
  "/aws/lambda/downloader_completeProcessPublisher"
  "/aws/lambda/downloader_completeProcessGame"
  "/aws/lambda/downloader_completeProcessCollection"
  "/aws/lambda/downloader_completeProcessPlays"
  "/aws/lambda/downloader_insideWriteResults"
  "/aws/lambda/RustDownloaderStack-rustfndownloadEDF6ACE5-unku0hfrneWa"
  "/aws/lambda/misc_auth_thread"
  "/aws/lambda/misc_counts"
  "/aws/lambda/misc_message"
  "/aws/lambda/misc_daily"
  "/aws/lambda/misc_cw"
)

QUERY='fields @timestamp, @logStream, @message
| filter @message like /Error/ or @message like /Status: timeout/
| sort @timestamp desc
| limit 200'

QUERY_ID=$(aws logs start-query \
  --region "$REGION" --profile "$PROFILE" \
  --log-group-names "${LOG_GROUPS[@]}" \
  --start-time "$START" --end-time "$END" \
  --query-string "$QUERY" \
  --output text)

echo start "$START" end "$END"
echo "Query $QUERY_ID started. Waiting for results..."

while true; do
  RESULT=$(aws logs get-query-results \
    --region "$REGION" --profile "$PROFILE" \
    --query-id "$QUERY_ID" \
    --output json)
  STATUS=$(echo "$RESULT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  case "$STATUS" in
    Complete) break ;;
    Failed|Cancelled|Timeout)
      echo "Query ended with status: $STATUS" >&2
      exit 1 ;;
    *) sleep 2 ;;
  esac
done

echo "$RESULT" | python3 -c '
import json, re, sys
data = json.load(sys.stdin)
rows = data.get("results", [])
if not rows:
    print("No lines containing Error in the time window.")
prefix = re.compile(r"^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s+[0-9a-fA-F-]{36}\s+")
for row in rows:
    f = {c["field"]: c["value"] for c in row}
    ts = f.get("@timestamp", "")
    # @log looks like "accountid:/aws/lambda/name", so keep only the name
    group = f.get("@log", "").split(":", 1)[-1].replace("/aws/lambda/", "")
    msg = prefix.sub("", f.get("@message", ""))
    msg = " ".join(msg.split())   # collapse stack traces and newlines onto one line
    print(ts + "  " + group + "  " + msg)
'
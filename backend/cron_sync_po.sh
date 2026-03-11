#!/bin/bash
# Cron script to sync PO data to external panel every 30 minutes

WEBHOOK_URL="https://vendor-mgmt-v2.preview.emergentagent.com/api/jobs/sync-po-data"
WEBHOOK_SECRET="oll_cron_secret_2024"

curl -X POST "${WEBHOOK_URL}?secret=${WEBHOOK_SECRET}" \
  --silent \
  --max-time 30 \
  -o /dev/null \
  -w "PO Sync triggered at $(date): HTTP %{http_code}\n" >> /var/log/po_sync.log 2>&1

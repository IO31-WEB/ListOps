#!/usr/bin/env bash
# RESTORE TEST — proves a backup actually restores. Never touches production.
#
#   1. Create an EMPTY scratch database: in Neon, create a new branch (or project) and copy its connection string.
#   2. Download a backup:  aws s3 cp s3://<BACKUP_BUCKET>/db/<file>.sql.gz . --endpoint-url "$R2_ENDPOINT"
#   3. Run:  TARGET_DATABASE_URL='postgresql://…scratch…' ./scripts/restore-test.sh listops-2026….sql.gz
#   4. Compare the printed row counts with production (they should be close to identical, minus rows created since the backup).
#   5. Delete the scratch branch.
set -euo pipefail
backup="${1:?usage: restore-test.sh <backup.sql.gz>}"
: "${TARGET_DATABASE_URL:?set TARGET_DATABASE_URL to a SCRATCH database}"

# Safety rail: refuse to restore into the production database.
prod_host="$(echo "${DATABASE_URL:-}" | sed -E 's#.*@([^/:?]+).*#\1#')"
target_host="$(echo "$TARGET_DATABASE_URL" | sed -E 's#.*@([^/:?]+).*#\1#')"
if [ -n "$prod_host" ] && [ "$prod_host" = "$target_host" ]; then
  echo "REFUSING: TARGET_DATABASE_URL points at the same host as DATABASE_URL (production)."; exit 1
fi

echo "Restoring $backup into scratch database $target_host …"
gunzip -c "$backup" | psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q

echo; echo "Row counts in the restored copy:"
psql "$TARGET_DATABASE_URL" -At -F ' : ' -c "
  select 'users', count(*) from users union all
  select 'organizations', count(*) from organizations union all
  select 'listings', count(*) from listings union all
  select 'campaigns', count(*) from campaigns union all
  select 'subscriptions', count(*) from subscriptions union all
  select 'audit_logs', count(*) from audit_logs;"
echo; echo "Newest campaign in the backup:"
psql "$TARGET_DATABASE_URL" -At -c "select max(created_at) from campaigns;"
echo "OK — restore works. Now delete the scratch database/branch."

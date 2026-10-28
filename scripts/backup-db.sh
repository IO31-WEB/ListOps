#!/usr/bin/env bash
# Logical backup of the production database to a Cloudflare R2 bucket (S3-compatible).
# Independent of Neon's own restore window — this is the copy you can fall back on if the history window has expired.
#
# Required env vars (GitHub Actions secrets, see .github/workflows/db-backup.yml):
#   DATABASE_URL_UNPOOLED   Neon DIRECT (non-pooled) connection string — pg_dump needs it
#   BACKUP_BUCKET           name of a PRIVATE R2 bucket used only for backups (not the public photo bucket!)
#   R2_ENDPOINT             https://<ACCOUNT_ID>.r2.cloudflarestorage.com
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY   R2 API token limited to that bucket
set -euo pipefail
: "${DATABASE_URL_UNPOOLED:?missing}" "${BACKUP_BUCKET:?missing}" "${R2_ENDPOINT:?missing}"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
file="/tmp/listops-${ts}.sql.gz"

echo "Dumping database…"
pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL_UNPOOLED" | gzip -9 > "$file"

# Refuse to upload an obviously broken dump (e.g. connection failed halfway)
size=$(stat -c%s "$file")
if [ "$size" -lt 2000 ]; then echo "Dump is suspiciously small ($size bytes) — aborting"; exit 1; fi
gunzip -t "$file"   # integrity check of the gzip stream

echo "Uploading ${size} bytes…"
aws s3 cp "$file" "s3://${BACKUP_BUCKET}/db/listops-${ts}.sql.gz" --endpoint-url "$R2_ENDPOINT"
echo "Backup complete: db/listops-${ts}.sql.gz"
# Retention: set an R2 lifecycle rule on the bucket to delete objects under db/ after 30 days (Dashboard -> R2 -> bucket -> Settings).

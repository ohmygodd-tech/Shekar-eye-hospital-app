#!/bin/sh
# Nightly backup of the database and uploaded reports. Run from cron, e.g.:
#   30 2 * * *  /opt/shekar/deploy/backup.sh >> /var/log/shekar-backup.log 2>&1
# Copy the backups folder off the server (e.g. to S3 / Google Drive) — a backup on the same disk is not a backup.
set -e
cd "$(dirname "$0")"
STAMP=$(date +%F)
mkdir -p backups
docker compose exec -T db pg_dump -U hospital -Fc hospital > "backups/db-$STAMP.dump"
docker compose exec -T api tar -czf - -C /data uploads > "backups/uploads-$STAMP.tgz"
find backups -type f -mtime +30 -delete
echo "Backup $STAMP done"

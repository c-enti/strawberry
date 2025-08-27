#!/usr/bin/env bash
# Simple log rotation: keep last N files and remove older than MAX_DAYS
LOG_DIR=${1:-server/logs}
MAX_FILES=${2:-10}
MAX_DAYS=${3:-30}

mkdir -p "$LOG_DIR"
# remove files older than MAX_DAYS
find "$LOG_DIR" -type f -mtime +$MAX_DAYS -print0 | xargs -0 -r rm -f
# keep only the newest MAX_FILES, delete older
ls -1t "$LOG_DIR" 2>/dev/null | tail -n +$((MAX_FILES+1)) | while read -r f; do
  rm -f "$LOG_DIR/$f"
done

echo "Log rotation complete for $LOG_DIR"

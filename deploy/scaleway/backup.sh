#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec python3 ./backup.py backup "${1:?Usage: backup.sh <daily/date-or-release/sha>}"

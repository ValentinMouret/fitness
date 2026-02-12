#!/bin/bash
# Check if schema and migrations are in sync
# Fails if drizzle-kit generate would create new migration files

set -euo pipefail

echo "Checking for schema/migration drift..."

# Count migration files before
BEFORE=$(ls -1 drizzle/*.sql 2>/dev/null | wc -l)

# Run generate (creates new migration if schema changed)
bun x drizzle-kit generate --config drizzle.config.ts 2>&1

# Count migration files after
AFTER=$(ls -1 drizzle/*.sql 2>/dev/null | wc -l)

if [ "$AFTER" -gt "$BEFORE" ]; then
  echo ""
  echo "❌ Schema drift detected!"
  echo "   New migration file(s) were generated."
  echo "   Run 'bun run db:generate' locally and commit the migration."
  echo ""
  # Show the new files
  ls -1 drizzle/*.sql | tail -n $((AFTER - BEFORE))
  exit 1
fi

echo "✓ Schema and migrations are in sync"

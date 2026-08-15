#!/usr/bin/env bash
# Apply every migration in order. Stops at the first failure.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL first}"
for f in "$(dirname "$0")"/../supabase/migrations/*.sql; do
  echo "==> $(basename "$f")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "All migrations applied."

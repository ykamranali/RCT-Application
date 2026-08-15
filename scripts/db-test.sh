#!/usr/bin/env bash
# Run the SQL test suites. Both roll back; safe against a seeded database.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL first}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")"/../supabase/tests/01_sla_and_workflow.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$(dirname "$0")"/../supabase/tests/02_rls_isolation.sql

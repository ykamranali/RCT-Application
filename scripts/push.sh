#!/usr/bin/env bash
#
# RCT Application — one-command publish.
#
# Pushes this repository to GitHub and applies the database to Supabase.
# Run it from the project root on your own machine:
#
#   bash scripts/push.sh
#
# It is safe to re-run: git push is incremental, and every migration is
# written to be idempotent (CREATE ... IF NOT EXISTS / CREATE OR REPLACE).
#
set -euo pipefail

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'

step()  { echo; echo "${BOLD}==> $*${RESET}"; }
ok()    { echo "${GREEN}  ✓${RESET} $*"; }
warn()  { echo "${YELLOW}  !${RESET} $*"; }
fail()  { echo "${RED}  ✗${RESET} $*"; exit 1; }

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "${BOLD}RCT Application — publish${RESET}"
echo "${DIM}${ROOT}${RESET}"

# ---------------------------------------------------------------------
# 0. Load configuration
# ---------------------------------------------------------------------
if [ -f apps/web/.env.local ]; then
  # shellcheck disable=SC1091
  set -a; . apps/web/.env.local; set +a
  ok "Loaded apps/web/.env.local"
elif [ -f .env.local ]; then
  set -a; . .env.local; set +a
  ok "Loaded .env.local"
else
  warn "No .env.local found — DATABASE_URL must already be exported"
fi

GITHUB_REPO="${GITHUB_REPO:-rct-application}"
GITHUB_VISIBILITY="${GITHUB_VISIBILITY:-private}"

# ---------------------------------------------------------------------
# 1. Preflight
# ---------------------------------------------------------------------
step "Checking prerequisites"

command -v git  >/dev/null 2>&1 || fail "git is not installed — https://git-scm.com/downloads"
ok "git $(git --version | awk '{print $3}')"

if command -v psql >/dev/null 2>&1; then
  ok "psql $(psql --version | awk '{print $3}')"
  HAVE_PSQL=1
else
  warn "psql not found — the database step will be skipped"
  warn "Install the PostgreSQL client tools to enable it: https://www.postgresql.org/download/"
  HAVE_PSQL=0
fi

if command -v gh >/dev/null 2>&1; then
  ok "gh $(gh --version | head -1 | awk '{print $3}')"
  HAVE_GH=1
else
  HAVE_GH=0
fi

# ---------------------------------------------------------------------
# 2. Git repository
# ---------------------------------------------------------------------
step "Preparing the git repository"

if [ ! -d .git ]; then
  git init -q
  git branch -M main
  ok "Initialised a new repository on branch main"
else
  ok "Existing repository found"
fi

# Refuse to publish real credentials.
if git ls-files --error-unmatch apps/web/.env.local >/dev/null 2>&1; then
  fail "apps/web/.env.local is tracked by git. Run: git rm --cached apps/web/.env.local"
fi
if [ -f .env ] && git ls-files --error-unmatch .env >/dev/null 2>&1; then
  fail ".env is tracked by git. Run: git rm --cached .env"
fi
ok "No credential files are staged"

git add -A
if git diff --cached --quiet; then
  ok "Nothing new to commit"
else
  git -c user.name="${GIT_AUTHOR_NAME:-$(git config user.name || echo 'RCT')}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-$(git config user.email || echo 'dev@ramcomputer.ae')}" \
      commit -q -m "RCT Application — service management platform"
  ok "Committed working tree"
fi

# ---------------------------------------------------------------------
# 3. GitHub
# ---------------------------------------------------------------------
step "Publishing to GitHub"

if git remote get-url origin >/dev/null 2>&1; then
  ok "Remote 'origin' already set to $(git remote get-url origin)"
else
  if [ "$HAVE_GH" = "1" ] && gh auth status >/dev/null 2>&1; then
    OWNER="$(gh api user --jq .login)"
    if gh repo view "$OWNER/$GITHUB_REPO" >/dev/null 2>&1; then
      ok "Repository $OWNER/$GITHUB_REPO already exists"
      git remote add origin "https://github.com/$OWNER/$GITHUB_REPO.git"
    else
      gh repo create "$GITHUB_REPO" \
        --"$GITHUB_VISIBILITY" \
        --source=. \
        --remote=origin \
        --description "RCT Application — Service Management Platform for Ram Computer Technology LLC"
      ok "Created $OWNER/$GITHUB_REPO ($GITHUB_VISIBILITY)"
    fi
  else
    echo
    warn "The GitHub CLI is not installed or not signed in."
    echo "  Either install it (https://cli.github.com) and run: gh auth login"
    echo "  Or create an empty repository on github.com and then run:"
    echo
    echo "    git remote add origin https://github.com/<you>/$GITHUB_REPO.git"
    echo "    git push -u origin main"
    echo
    warn "Skipping the GitHub step"
  fi
fi

if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin main
  ok "Pushed to $(git remote get-url origin)"
fi

# ---------------------------------------------------------------------
# 4. Supabase
# ---------------------------------------------------------------------
step "Applying the database to Supabase"

if [ "$HAVE_PSQL" = "0" ]; then
  warn "Skipped — psql is not installed"
elif [ -z "${DATABASE_URL:-}" ]; then
  warn "Skipped — DATABASE_URL is not set"
  echo "  Supabase dashboard → Project Settings → Database → Connection string (URI)"
  echo "  Add it to apps/web/.env.local as DATABASE_URL=postgresql://..."
else
  # Fail fast on an unreachable database rather than half-applying.
  if ! psql "$DATABASE_URL" -c 'select 1' >/dev/null 2>&1; then
    fail "Could not connect to DATABASE_URL. Check the password and that your IP is allowed."
  fi
  ok "Connected"

  applied=0
  for f in supabase/migrations/*.sql; do
    printf '   %-42s' "$(basename "$f")"
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>&1; then
      echo "${GREEN}ok${RESET}"
      applied=$((applied + 1))
    else
      echo "${RED}failed${RESET}"
      echo
      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" 2>&1 | tail -20
      fail "Migration $(basename "$f") failed — nothing after it was applied"
    fi
  done
  ok "$applied migrations applied"

  # Verify the security posture actually took effect.
  UNPROTECTED="$(psql "$DATABASE_URL" -tAc \
    "select count(*) from pg_tables where schemaname='public' and not rowsecurity")"
  if [ "$UNPROTECTED" = "0" ]; then
    ok "Row Level Security is enabled on every public table"
  else
    warn "$UNPROTECTED table(s) in public have RLS disabled — investigate before going live"
  fi

  POLICIES="$(psql "$DATABASE_URL" -tAc \
    "select count(*) from pg_policies where schemaname in ('public','storage')")"
  ok "$POLICIES security policies installed"

  if [ "${SEED_DEMO_DATA:-0}" = "1" ]; then
    warn "SEED_DEMO_DATA=1 — loading demo data (this DELETES existing customers and tickets)"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed/seed.sql
    ok "Demo data loaded (password: RctDemo!2026)"
  else
    echo "   ${DIM}Demo data skipped. To load it: SEED_DEMO_DATA=1 bash scripts/push.sh${RESET}"
  fi

  step "Running the database test suites"
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/01_sla_and_workflow.sql 2>&1 | grep -q "All SLA and workflow tests passed"; then
    ok "SLA and workflow suite passed (45 assertions)"
  else
    warn "SLA suite reported failures — run it directly to see which"
  fi
fi

# ---------------------------------------------------------------------
# 5. Done
# ---------------------------------------------------------------------
step "Next steps"
cat <<'NEXT'
  1. Install dependencies and build:
       npm install
       npm run build

  2. Deploy the web app to Vercel:
       npx vercel link
       npx vercel --prod
     Set the environment variables from .env.example in the Vercel dashboard.

  3. Create your first administrator:
       see docs/DEMO_ACCOUNTS.md → "Creating the first production administrator"

  4. Configure the company and email settings inside the application:
       Settings → Company, then Settings → Email → Send test email
NEXT
echo
ok "Finished"

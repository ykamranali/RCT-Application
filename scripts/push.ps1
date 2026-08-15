# RCT Application - one-command publish (Windows PowerShell)
#
#   powershell -ExecutionPolicy Bypass -File scripts\push.ps1
#
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "  [x]  $m" -ForegroundColor Red; exit 1 }

Write-Host "RCT Application - publish" -ForegroundColor White

# ---- configuration ---------------------------------------------------
$envFile = 'apps\web\.env.local'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $value = $matches[2].Trim().Trim('"')
      [Environment]::SetEnvironmentVariable($matches[1], $value, 'Process')
    }
  }
  Ok "Loaded $envFile"
} else {
  Warn "No $envFile found - DATABASE_URL must already be set"
}

$repo = if ($env:GITHUB_REPO) { $env:GITHUB_REPO } else { 'rct-application' }

# ---- preflight -------------------------------------------------------
Step 'Checking prerequisites'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail 'git is not installed - https://git-scm.com/downloads' }
Ok "git $((git --version).Split(' ')[2])"

$havePsql = [bool](Get-Command psql -ErrorAction SilentlyContinue)
if ($havePsql) { Ok 'psql found' } else { Warn 'psql not found - the database step will be skipped' }

$haveGh = [bool](Get-Command gh -ErrorAction SilentlyContinue)

# ---- git -------------------------------------------------------------
Step 'Preparing the git repository'
if (-not (Test-Path '.git')) {
  git init -q
  git branch -M main
  Ok 'Initialised a new repository on branch main'
} else { Ok 'Existing repository found' }

git add -A
$staged = git diff --cached --name-only
if ($staged) {
  git commit -q -m "RCT Application - service management platform"
  Ok 'Committed working tree'
} else { Ok 'Nothing new to commit' }

# ---- github ----------------------------------------------------------
Step 'Publishing to GitHub'
$hasOrigin = $false
try { git remote get-url origin | Out-Null; $hasOrigin = $true } catch { $hasOrigin = $false }

if (-not $hasOrigin) {
  if ($haveGh) {
    gh repo create $repo --private --source=. --remote=origin --description "RCT Application - Service Management Platform for Ram Computer Technology LLC"
    Ok "Created $repo (private)"
  } else {
    Warn 'GitHub CLI not installed (https://cli.github.com).'
    Write-Host "  Create an empty repository on github.com, then run:"
    Write-Host "    git remote add origin https://github.com/<you>/$repo.git"
    Write-Host "    git push -u origin main"
  }
}

try {
  git remote get-url origin | Out-Null
  git push -u origin main
  Ok "Pushed to $(git remote get-url origin)"
} catch { Warn 'Skipped the push - no remote configured' }

# ---- supabase --------------------------------------------------------
Step 'Applying the database to Supabase'
if (-not $havePsql) {
  Warn 'Skipped - psql is not installed'
} elseif (-not $env:DATABASE_URL) {
  Warn 'Skipped - DATABASE_URL is not set'
} else {
  psql $env:DATABASE_URL -c 'select 1' *> $null
  if ($LASTEXITCODE -ne 0) { Fail 'Could not connect to DATABASE_URL' }
  Ok 'Connected'

  Get-ChildItem 'supabase\migrations\*.sql' | Sort-Object Name | ForEach-Object {
    Write-Host ("   {0,-42}" -f $_.Name) -NoNewline
    psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -q -f $_.FullName *> $null
    if ($LASTEXITCODE -eq 0) { Write-Host 'ok' -ForegroundColor Green }
    else { Write-Host 'failed' -ForegroundColor Red; Fail "Migration $($_.Name) failed" }
  }
  Ok 'All migrations applied'

  $unprotected = psql $env:DATABASE_URL -tAc "select count(*) from pg_tables where schemaname='public' and not rowsecurity"
  if ($unprotected -eq '0') { Ok 'Row Level Security enabled on every public table' }
  else { Warn "$unprotected table(s) have RLS disabled" }

  if ($env:SEED_DEMO_DATA -eq '1') {
    Warn 'Loading demo data (this DELETES existing customers and tickets)'
    psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -q -f 'supabase\seed\seed.sql'
    Ok 'Demo data loaded (password: RctDemo!2026)'
  }
}

Step 'Next steps'
Write-Host @'
  1. npm install; npm run build
  2. npx vercel link; npx vercel --prod
  3. Create your first administrator - see docs\DEMO_ACCOUNTS.md
  4. Settings -> Company, then Settings -> Email -> Send test email
'@
Ok 'Finished'

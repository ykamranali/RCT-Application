# RCT Application

**Ram Computer Technology LLC — Service Management Platform**

Customer complaint and IT service desk system covering ticketing, engineer
dispatch, SLA management, AMC contracts, asset registers, service reports and
management reporting.

---

## Status of this build

Everything below has been executed, not merely written.

| Layer | State | Verified how |
|---|---|---|
| PostgreSQL schema (45 tables, 17 migrations) | **Verified** | Applied to a live PostgreSQL 16 instance from empty, repeatedly |
| Triggers, workflow state machine, numbering | **Verified** | 45 assertions pass |
| SLA engine (business hours, holidays, pause accounting) | **Verified** | 45 assertions pass |
| Row Level Security (105 policies) | **Verified** | 45 tenant-isolation assertions pass |
| Seed data (5 customers, 12 staff, 50 tickets…) | **Verified** | Loads clean from empty |
| TypeScript across web + mobile | **Verified** | `tsc --noEmit` passes with zero errors |
| Next.js production build | **Verified** | `next build` succeeds — 22 routes, 17 prerendered |
| Application boots and serves | **Verified** | `next start`; `/login` returns 200 and renders; security headers present |
| Service report PDF generator | **Verified** | Renders a real 2-page A4 report from live seeded data, with an embedded signature |
| Email service (SMTP + Resend) | **Written** | Compiles; not exercised against a live mail server |
| Ticket closure pipeline | **Written** | Compiles; needs a live Supabase project to run end to end |
| Android app (Expo) | **Written** | Type-checks; no APK built yet |

**Still to do before production:** connect a Supabase project (auth, storage and
PostgREST cannot be exercised without one), configure SMTP and send a test
email, then build the APK per [`docs/ANDROID.md`](docs/ANDROID.md).

---

## Publishing

One command, from the project root:

```bash
bash scripts/push.sh          # macOS / Linux
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\push.ps1   # Windows
```

It creates the GitHub repository (via the `gh` CLI if installed), pushes,
then applies every migration to the Supabase project in `DATABASE_URL` and
verifies that Row Level Security is enabled on all tables. Re-running is
safe. Add `SEED_DEMO_DATA=1` to also load the demo data.

To apply the database from CI instead, add `DATABASE_URL` as a repository
secret and run the **Deploy database to Supabase** workflow.

---

## Requirements

- **Node.js 20 or later** — <https://nodejs.org>
- **npm 10+** (ships with Node 20)
- **A Supabase project** — <https://supabase.com>
- **psql** (PostgreSQL client) for migrations and seeding
- **Supabase CLI** (optional but recommended): `npm i -g supabase`

---

## 1. Install

```bash
git clone <your-repository-url> rct-application
cd rct-application
npm install
```

This is an npm workspaces monorepo, so a single install at the root covers
`apps/web` and `packages/*`.

---

## 2. Create the Supabase project

1. Create a new project at <https://supabase.com/dashboard>.
2. Choose a region close to the UAE (`eu-central-1` or `ap-south-1`).
3. Note the database password — you will need it for `DATABASE_URL`.
4. From **Project Settings → API**, copy the Project URL, the `anon` key and
   the `service_role` key.

---

## 3. Configure environment variables

```bash
cp .env.example apps/web/.env.local
```

Fill in at minimum:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` |
| `DATABASE_URL` | Project Settings → Database → Connection string (URI) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for development |
| `CRON_SECRET` | `openssl rand -base64 32` |

`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Keep it server-side,
never prefix it with `NEXT_PUBLIC_`, and rotate it immediately if it is ever
committed or pasted anywhere public.

---

## 4. Run the database migrations

Apply the 17 migrations in order:

```bash
for f in supabase/migrations/*.sql; do
  echo "applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

On Windows PowerShell:

```powershell
Get-ChildItem supabase\migrations\*.sql | Sort-Object Name | ForEach-Object {
  Write-Host "applying $($_.Name)"
  psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName
}
```

Or, with the Supabase CLI linked to your project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### What the migrations install

| File | Contents |
|---|---|
| `0001_foundation` | Extensions, `app` schema, enums, document numbering |
| `0002_identity` | Roles, permissions, profiles, authorisation helpers |
| `0003_customers` | Customers, branches, portal contacts |
| `0004_employees` | Employees, skills, certifications, coverage |
| `0005_catalog_and_sla` | Categories, priorities, SLA plans, business calendar, settings |
| `0006_tickets` | Tickets, timeline, comments, attachments, parts, labour, visits |
| `0007_service_reports` | Service reports, signatures, feedback, approvals |
| `0008_amc_and_assets` | AMC contracts and the asset register |
| `0009_notifications_and_email` | Notification centre, templates, delivery log |
| `0010_audit` | Append-only audit trail with automatic row auditing |
| `0011_sla_engine` | Business-hours arithmetic, SLA classification, sweep job |
| `0012_ticket_workflow` | State machine, lifecycle stamps, pause accounting, numbering |
| `0013_rls` | Row Level Security across every table |
| `0014_views_and_rpc` | Reporting views, dashboard aggregate, customer RPCs, search |
| `0015_storage` | Private storage buckets and their access policies |
| `0016_baseline_data` | Roles, permissions, catalogue, SLA targets, UAE calendar, settings |
| `0017_email_templates` | 14 configurable email templates |

---

## 5. Load demo data (development only)

```bash
psql "$DATABASE_URL" -f supabase/seed/seed.sql
```

Creates 5 customers, 10 branches, 12 staff, 50 tickets with full timelines,
30 assets, 5 AMC contracts, 20 service reports, signatures and feedback.

Demo account credentials are documented in [`docs/DEMO_ACCOUNTS.md`](docs/DEMO_ACCOUNTS.md).
**Never run the seed against production** — it deletes existing customer,
employee and ticket data first.

---

## 6. Run the automated tests

The database test suites run against any PostgreSQL instance with the
migrations applied:

```bash
psql "$DATABASE_URL" -f supabase/tests/01_sla_and_workflow.sql
psql "$DATABASE_URL" -f supabase/tests/02_rls_isolation.sql
```

Both suites run inside a transaction that is rolled back, so they leave no
residue. They exit non-zero on failure and are safe to wire into CI.

- **Suite 1 (45 assertions)** — business-hours arithmetic across the UAE
  weekend and public holidays, SLA classification thresholds, document
  numbering, deadline stamping, the full ticket state machine, mandatory-field
  enforcement, SLA pause accounting and data-integrity constraints.
- **Suite 2 (44 assertions)** — cross-tenant read and write isolation,
  internal-note visibility, customer write paths, privilege escalation,
  append-only audit and signature tables, and anonymous access.

---

## 7. Local development

```bash
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint
npm run build        # production build
```

---

## Project structure

```
rct-application/
├── apps/
│   ├── web/                    Next.js 15 application
│   │   ├── src/
│   │   │   ├── app/            App Router routes
│   │   │   ├── components/     UI components
│   │   │   ├── lib/
│   │   │   │   ├── supabase/   Browser, server and admin clients
│   │   │   │   ├── email/      Template rendering, SMTP/Resend transport
│   │   │   │   ├── pdf/        Service report renderer
│   │   │   │   └── tickets/    Closure pipeline
│   │   │   ├── styles/         Design tokens
│   │   │   └── middleware.ts   Session refresh + route gate
│   │   └── tailwind.config.ts
│   └── mobile/                 Expo application (not yet built)
├── packages/
│   ├── types/                  Shared domain + database types
│   ├── ui/                     Shared components (reserved)
│   └── config/                 Shared configuration (reserved)
├── supabase/
│   ├── migrations/             17 ordered migrations
│   ├── seed/                   Development seed data
│   └── tests/                  SQL test suites + local PostgreSQL shim
├── docs/
└── .env.example
```

---

## Architecture notes

**Security is enforced in the database, not the UI.** Every table has Row
Level Security enabled. A customer contact querying `tickets` receives only
their own company's rows because PostgreSQL filters them, not because a
React component chose not to render them. The API layer performs its own
permission checks as well, but each of those is deliberately redundant.

**Customers have no `UPDATE` policy on tickets.** Customer-initiated actions
— reopening, approving work, leaving feedback — go through
`SECURITY DEFINER` functions that validate ownership and eligibility first.
This means there is no column-level surface for a customer to tamper with.

**The SLA clock understands the UAE working week.** Targets are consumed
against each plan's business hours (Standard: Sunday–Thursday 08:00–18:00),
skip configured public holidays, and pause while a ticket sits in `ON_HOLD`,
`PENDING_CUSTOMER` or `PENDING_PARTS`. Resuming pushes the deadline out by
exactly the elapsed pause.

**Service reports are immutable snapshots.** The `snapshot` column captures
customer name, category and priority as they were at closure, so renaming a
customer later never alters a report a customer has already signed.

**The audit log cannot be rewritten.** `audit_logs` has a `SELECT` policy for
management and no `INSERT`, `UPDATE` or `DELETE` policy for any role. Rows
arrive only through `SECURITY DEFINER` triggers.

---

## Further documentation

- [`docs/DEMO_ACCOUNTS.md`](docs/DEMO_ACCOUNTS.md) — demo credentials and how to create the first production administrator
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel and Supabase deployment
- [`docs/ANDROID.md`](docs/ANDROID.md) — mobile application and APK build

---

© Ram Computer Technology LLC

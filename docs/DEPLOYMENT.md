# Deployment

Frontend on Vercel, database and storage on Supabase.

---

## 1. Supabase (database, auth, storage)

### Create and migrate

1. Create the project at <https://supabase.com/dashboard>. Pick a region
   close to the UAE — `eu-central-1` (Frankfurt) or `ap-south-1` (Mumbai)
   both give acceptable latency from the Gulf.
2. Apply the migrations:

   ```bash
   for f in supabase/migrations/*.sql; do
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break
   done
   ```

3. Verify the security posture before going live:

   ```sql
   -- Every table in public must have RLS enabled. This must return zero rows.
   select tablename
   from pg_tables
   where schemaname = 'public'
     and not rowsecurity;

   -- Every table should have at least one policy. Review anything listed.
   select t.tablename
   from pg_tables t
   left join pg_policies p
     on p.schemaname = t.schemaname and p.tablename = t.tablename
   where t.schemaname = 'public'
   group by t.tablename
   having count(p.policyname) = 0;
   ```

4. Run the isolation suite against the deployed database:

   ```bash
   psql "$DATABASE_URL" -f supabase/tests/02_rls_isolation.sql
   ```

   It rolls back, so it is safe against a populated database — but it does
   require seeded customers to compare against, so run it on staging.

### Storage

Migration `0015` creates five private buckets: `ticket-attachments`,
`service-reports`, `signatures`, `avatars` and `company`.

Confirm in **Storage** that all five exist and none is marked public. Files
are served to browsers through short-lived signed URLs minted server-side
after the API has checked permissions — no bucket should ever be public.

Upload the company logo to `company/logo.png`, or change the
`company_logo_path` setting to match wherever you put it.

### Auth

**Authentication → URL Configuration**

- Site URL: `https://your-domain.ae`
- Redirect URLs: add `https://your-domain.ae/auth/callback` and, for local
  work, `http://localhost:3000/auth/callback`

**Authentication → Providers → Email** — enable "Confirm email".

**Authentication → Rate limits** — the defaults are sensible; lower the
sign-in limit if the portal is internet-facing.

### Backups

Point-in-time recovery is a paid feature and is worth enabling before you
have live customer data. At minimum, confirm daily backups are on under
**Database → Backups**.

---

## 2. Vercel (web application)

### Import

1. Push the repository to GitHub.
2. **Add New → Project** in Vercel, import the repository.
3. Framework preset: **Next.js**.
4. Root directory: **`apps/web`**.
5. Leave build and install commands at their defaults — Vercel detects the
   npm workspace and installs from the repository root.

### Environment variables

Add these under **Settings → Environment Variables** for Production,
Preview and Development:

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | All | **Secret.** Never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_APP_URL` | All | `https://your-domain.ae` |
| `CRON_SECRET` | All | `openssl rand -base64 32` |
| `EMAIL_PROVIDER` | All | `smtp` or `resend` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | All | If using SMTP |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | All | **Secret** |
| `RESEND_API_KEY` | All | **Secret**, if using Resend |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` / `EMAIL_REPLY_TO` | All | |

Email settings entered in the application at **Settings → Email** override
these; the environment is the fallback for a fresh deployment.

### Deploy

```bash
npm i -g vercel
vercel link
vercel --prod
```

Or simply push to `main` once the GitHub integration is connected.

### Custom domain

**Settings → Domains** → add `service.yourdomain.ae`, then create the
CNAME record Vercel shows you. TLS is provisioned automatically.

---

## 3. Scheduled jobs

Two jobs keep derived state current.

| Job | Endpoint | Suggested schedule | Purpose |
|---|---|---|---|
| SLA sweep | `POST /api/cron/sla` | Every 15 minutes | Reclassify open tickets, raise at-risk and breach notifications |
| AMC refresh | `POST /api/cron/amc` | Daily 02:00 GST | Move contracts between ACTIVE / EXPIRING / EXPIRED, send expiry warnings |

Both call the corresponding database function (`app.sweep_sla()` and
`app.refresh_amc_statuses()`) and must be protected with `CRON_SECRET`.

### Option A — Vercel Cron

`apps/web/vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/sla", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/amc", "schedule": "0 22 * * *" }
  ]
}
```

Vercel cron schedules are **UTC**. `0 22 * * *` fires at 02:00 Gulf
Standard Time the following day.

### Option B — pg_cron inside Supabase

No external scheduler, and it keeps working even if the web app is down:

```sql
create extension if not exists pg_cron;

select cron.schedule('rct-sla-sweep',  '*/15 * * * *', $$ select app.sweep_sla() $$);
select cron.schedule('rct-amc-status', '0 22 * * *',   $$ select app.refresh_amc_statuses() $$);
```

Note that `pg_cron` covers the state transitions but not the outbound
warning emails, which are sent by the API route. Running both is reasonable:
the database stays correct regardless, and the route handles delivery.

---

## 4. Production checklist

**Security**

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set as a secret and appears nowhere in the repository
- [ ] `git log -p | grep -i "service_role"` returns nothing
- [ ] The RLS verification queries above return zero rows
- [ ] `supabase/tests/02_rls_isolation.sql` passes against staging
- [ ] All five storage buckets are private
- [ ] Auth redirect URLs list only domains you control
- [ ] The demo seed has **not** been run against production
- [ ] Every administrator account uses a unique password and a real address

**Configuration**

- [ ] Company name, logo, address and TRN set under Settings → Company
- [ ] Email configured and **Send test email** succeeds
- [ ] SLA targets reviewed against the contracts actually sold
- [ ] This year's Islamic-calendar holidays added
- [ ] Ticket and service report prefixes confirmed before the first ticket is raised

**Operations**

- [ ] Database backups / PITR enabled
- [ ] Both scheduled jobs firing (check `audit_logs` and `notifications`)
- [ ] A test ticket taken end to end: raise → assign → accept → on site → resolve → close
- [ ] The closure email arrives with the service report PDF attached
- [ ] The PDF renders correctly with the company logo and a captured signature

**Performance**

- [ ] `explain analyze` on the busiest ticket list query looks sane
- [ ] Supabase connection pooling enabled (Transaction mode) if you expect concurrency

---

## Troubleshooting

**"permission denied for schema app"**
`authenticated` is missing `USAGE` on the `app` schema. Re-run migration
`0013`.

**Users see no data at all after signing in**
Their `profiles` row is missing, `is_active` is false, or a customer
principal has a null `customer_id`. Check:

```sql
select id, email, role, is_active, customer_id, employee_id
from profiles where email = 'user@example.com';
```

**Closure email not arriving**
Look at `email_logs` — every attempt is recorded there with the transport
error:

```sql
select queued_at, status, to_addresses, subject, last_error
from email_logs order by queued_at desc limit 20;
```

**"Illegal ticket transition"**
The requested status is not reachable from the current one. Ask the database
what is legal:

```sql
select app.allowed_transitions('ON_HOLD');
```

**SLA deadlines look wrong**
Confirm the plan's business hours and that the customer is on the plan you
expect:

```sql
select c.company_name, s.code, s.is_24x7, s.pause_on_hold
from customers c join sla_plans s on s.id = c.sla_plan_id;

select day_of_week, opens_at, closes_at, is_working_day
from business_hours bh
join sla_plans s on s.id = bh.sla_plan_id
where s.code = 'STANDARD' order by day_of_week;
```

Remember that ISO day-of-week numbering is used: 1 = Monday, 7 = Sunday.

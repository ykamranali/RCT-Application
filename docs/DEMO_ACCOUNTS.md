# Demo accounts and first production administrator

## Development / demo credentials

`supabase/seed/seed.sql` creates the accounts below. Every one is flagged
`must_change_password = true`, so the application prompts for a new password
on first sign-in.

**Password for all demo accounts: `RctDemo!2026`**

To use a different password, edit this line near the top of `seed.sql`
before running it:

```sql
create temporary table _cfg as
select 'RctDemo!2026' as demo_password;
```

| Email | Name | Role | What they can do |
|---|---|---|---|
| `admin@ramcomputer.ae` | Imran Sheikh | Super Administrator | Everything, including role management |
| `operations@ramcomputer.ae` | Fatima Al Zaabi | Administrator | Settings, users, email configuration, audit log |
| `management@ramcomputer.ae` | Rajesh Menon | Management | Company-wide dashboards, analytics, reports |
| `servicemanager@ramcomputer.ae` | Nadia Haddad | Service Manager | Assignment, SLA monitoring, service delivery |
| `arun.kumar@ramcomputer.ae` | Arun Kumar | Engineer | Assigned tickets, site visits, service reports |
| `sameer.qureshi@ramcomputer.ae` | Sameer Qureshi | Engineer | As above |
| `daniel.okafor@ramcomputer.ae` | Daniel Okafor | Engineer | As above |
| `priya.nair@ramcomputer.ae` | Priya Nair | Engineer | As above |
| `mohammed.tariq@ramcomputer.ae` | Mohammed Tariq | Engineer | As above |
| `elena.petrova@ramcomputer.ae` | Elena Petrova | Engineer | As above |
| `joseph.mathew@ramcomputer.ae` | Joseph Mathew | Engineer | As above |
| `hassan.ali@ramcomputer.ae` | Hassan Ali | Engineer | As above |

### Customer portal accounts

| Email | Company | Role |
|---|---|---|
| `khalid.admin@gulfhorizon.example` | Gulf Horizon Trading LLC | Customer Administrator |
| `user.gulfhorizon@gulfhorizon.example` | Gulf Horizon Trading LLC | Customer User |
| `sofia.admin@meridianhg.example` | Meridian Hospitality Group | Customer Administrator |
| `yousef.admin@esfab.example` | Emirates Steel Fabrication | Customer Administrator |
| `grace.admin@northline.example` | Northline Logistics FZE | Customer Administrator |
| `dr..admin@alwahamedical.example` | Al Waha Medical Centre | Customer Administrator |

> The exact customer-admin addresses are derived from the seeded contact
> names. If you are unsure, list them with:
>
> ```sql
> select p.email, c.company_name, p.role
> from profiles p join customers c on c.id = p.customer_id
> order by c.customer_code;
> ```

These accounts are useful for verifying tenant isolation by hand: sign in as
one customer administrator and confirm that no other company's tickets,
branches, assets or reports are reachable anywhere in the interface.

---

## Creating the first production administrator

**Do not run `seed.sql` against production.** It deletes existing customer,
employee and ticket records before inserting demo data.

For a clean production database, apply the migrations only (`0001` through
`0017`), then create the first administrator:

### 1. Create the auth user

In the Supabase dashboard: **Authentication → Users → Add user**.

- Enter the real work email address.
- Choose **Auto Confirm User** so no verification email is needed.
- Set a long temporary password, or use **Send magic link** instead so no
  password is ever typed into the dashboard.

Copy the generated user UUID.

### 2. Create the matching profile and employee record

Run in **SQL Editor**, substituting the UUID and details:

```sql
insert into public.profiles (id, email, full_name, role, is_active, must_change_password)
values (
  '00000000-0000-0000-0000-000000000000',   -- the UUID from step 1
  'admin@yourdomain.ae',
  'Full Name',
  'super_admin',
  true,
  true                                       -- forces a password change at first sign-in
);

with new_employee as (
  insert into public.employees
    (employee_code, profile_id, full_name, email, job_title, role, joining_date, status)
  values
    ('EMP-0001',
     '00000000-0000-0000-0000-000000000000',
     'Full Name',
     'admin@yourdomain.ae',
     'Head of IT Operations',
     'super_admin',
     current_date,
     'active')
  returning id
)
update public.profiles
   set employee_id = (select id from new_employee)
 where id = '00000000-0000-0000-0000-000000000000';
```

### 3. Confirm it worked

```sql
select p.email, p.role, p.is_active, p.must_change_password, e.employee_code
from public.profiles p
left join public.employees e on e.id = p.employee_id
where p.role in ('super_admin', 'admin');
```

### 4. Configure the company

Sign in as that administrator and complete:

- **Settings → Company** — name, logo, address, TRN, report footer
- **Settings → Email** — SMTP or Resend credentials, then **Send test email**
- **Settings → SLA** — confirm the response and resolution targets
- **Settings → Holidays** — add this year's Islamic-calendar public holidays
  (Eid Al Fitr, Eid Al Adha, Islamic New Year, Prophet's Birthday). These
  move each year, so only the fixed-date holidays are pre-loaded.

Every subsequent user should be created from **Admin → Users** rather than
through the Supabase dashboard, so that the profile, employee record and
role assignment stay consistent and the action is written to the audit log.

---

## Security notes

- The demo password in this document is public. Change it before using the
  seed anywhere reachable from the internet.
- `must_change_password` is set on every seeded account, but it is a UI
  prompt, not a database constraint — treat demo accounts as compromised by
  definition.
- Never create production accounts with the `service_role` key from a script
  that is committed to the repository.
- Deactivate rather than delete departing staff: setting `is_active = false`
  revokes access immediately (the `app.current_role()` helper filters on it)
  while preserving their history on closed tickets and signed service reports.

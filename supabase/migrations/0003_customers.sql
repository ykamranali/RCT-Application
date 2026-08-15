-- =====================================================================
-- RCT APPLICATION | Migration 0003 - Customers, branches, contacts
-- =====================================================================

create table if not exists public.customers (
  id                uuid primary key default gen_random_uuid(),
  customer_code     text        not null unique,   -- CUS-0001
  company_name      text        not null,
  trade_licence_no  text,
  tax_registration_no text,
  contact_person    text,
  email             citext,
  phone             text,
  alternate_phone   text,
  address_line1     text,
  address_line2     text,
  city              text,
  emirate           text,
  country           text        not null default 'United Arab Emirates',
  customer_type     app.customer_type not null default 'ON_CALL',
  contract_number   text,
  amc_start_date    date,
  amc_expiry_date   date,
  sla_plan_id       uuid,                          -- FK added in 0005
  account_manager_id uuid,                         -- FK added in 0004
  status            app.record_status not null default 'active',
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint customers_amc_dates_valid
    check (amc_start_date is null or amc_expiry_date is null or amc_expiry_date >= amc_start_date)
);

create index if not exists idx_customers_status   on public.customers(status);
create index if not exists idx_customers_type     on public.customers(customer_type);
create index if not exists idx_customers_expiry   on public.customers(amc_expiry_date);
create index if not exists idx_customers_name_trgm
  on public.customers using gin (company_name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Branches / sites. A customer may operate many locations.
-- ---------------------------------------------------------------------
create table if not exists public.branches (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers(id) on delete cascade,
  branch_code     text not null,
  branch_name     text not null,
  contact_person  text,
  phone           text,
  email           citext,
  address_line1   text,
  address_line2   text,
  city            text,
  emirate         text,
  country         text not null default 'United Arab Emirates',
  latitude        numeric(9,6),
  longitude       numeric(9,6),
  working_hours   text,
  site_notes      text,
  is_head_office  boolean not null default false,
  status          app.record_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint branches_code_unique_per_customer unique (customer_id, branch_code),
  constraint branches_latitude_range  check (latitude  is null or latitude  between -90  and 90),
  constraint branches_longitude_range check (longitude is null or longitude between -180 and 180)
);

create index if not exists idx_branches_customer on public.branches(customer_id);
create index if not exists idx_branches_status   on public.branches(status);

-- Exactly one head office per customer (partial unique index).
create unique index if not exists uq_branches_head_office
  on public.branches(customer_id) where is_head_office;

-- ---------------------------------------------------------------------
-- Customer contacts that are not necessarily portal users, plus the
-- link table granting a profile access to a customer's data.
-- ---------------------------------------------------------------------
create table if not exists public.customer_users (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id)  on delete cascade,
  branch_id     uuid references public.branches(id) on delete set null,
  job_title     text,
  is_primary    boolean not null default false,
  can_approve_work boolean not null default false,
  status        app.record_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint customer_users_unique unique (customer_id, profile_id)
);

create index if not exists idx_customer_users_profile  on public.customer_users(profile_id);
create index if not exists idx_customer_users_customer on public.customer_users(customer_id);

select app.attach_touch_trigger('public.customers');
select app.attach_touch_trigger('public.branches');
select app.attach_touch_trigger('public.customer_users');

-- Now that customers/branches exist, close the loop on profiles.
alter table public.profiles
  drop constraint if exists profiles_customer_fk,
  add  constraint profiles_customer_fk
       foreign key (customer_id) references public.customers(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_branch_fk,
  add  constraint profiles_branch_fk
       foreign key (branch_id) references public.branches(id) on delete set null;

-- A customer principal must be attached to a customer; staff must not be.
alter table public.profiles
  drop constraint if exists profiles_scope_consistent,
  add  constraint profiles_scope_consistent check (
    (role in ('customer_admin', 'customer_user') and customer_id is not null)
    or
    (role in ('super_admin','admin','management','service_manager','engineer') and customer_id is null)
  ) not valid;

comment on constraint profiles_scope_consistent on public.profiles is
  'Guarantees a customer principal can never exist without a customer scope, which is what the RLS policies rely on for tenant isolation.';

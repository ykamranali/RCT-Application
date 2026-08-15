-- =====================================================================
-- RCT APPLICATION | Migration 0008 - AMC contracts and customer assets
-- =====================================================================

create table if not exists public.amc_contracts (
  id                uuid primary key default gen_random_uuid(),
  amc_number        text not null unique,              -- AMC-2026-0001
  customer_id       uuid not null references public.customers(id) on delete cascade,
  contract_type     text not null default 'COMPREHENSIVE',  -- COMPREHENSIVE | NON_COMPREHENSIVE | LABOUR_ONLY | REMOTE_SUPPORT
  sla_plan_id       uuid references public.sla_plans(id) on delete set null,

  start_date        date not null,
  expiry_date       date not null,
  renewal_notice_days int not null default 30 check (renewal_notice_days >= 0),
  auto_renew        boolean not null default false,

  covered_services  text[] not null default '{}',
  excluded_services text[] not null default '{}',
  visits_included   int check (visits_included is null or visits_included >= 0),
  visits_consumed   int not null default 0 check (visits_consumed >= 0),

  contract_value    numeric(14,2) check (contract_value >= 0),
  currency          char(3) not null default 'AED',
  payment_terms     text,
  billing_frequency text default 'ANNUAL',              -- ANNUAL | SEMI_ANNUAL | QUARTERLY | MONTHLY

  status            app.amc_status not null default 'ACTIVE',
  document_url      text,
  notes             text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint amc_dates_valid check (expiry_date >= start_date)
);

create index if not exists idx_amc_customer on public.amc_contracts(customer_id);
create index if not exists idx_amc_status   on public.amc_contracts(status);
create index if not exists idx_amc_expiry   on public.amc_contracts(expiry_date);

-- Sites covered by a contract
create table if not exists public.amc_branches (
  amc_contract_id uuid not null references public.amc_contracts(id) on delete cascade,
  branch_id       uuid not null references public.branches(id)      on delete cascade,
  primary key (amc_contract_id, branch_id)
);

-- Engineers assigned to a contract
create table if not exists public.amc_engineers (
  amc_contract_id uuid not null references public.amc_contracts(id) on delete cascade,
  employee_id     uuid not null references public.employees(id)     on delete cascade,
  is_primary      boolean not null default false,
  primary key (amc_contract_id, employee_id)
);

-- ---------------------------------------------------------------------
-- Asset register
-- ---------------------------------------------------------------------
create table if not exists public.asset_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  icon       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id                uuid primary key default gen_random_uuid(),
  asset_tag         text not null unique,             -- AST-000001
  customer_id       uuid not null references public.customers(id) on delete cascade,
  branch_id         uuid references public.branches(id) on delete set null,
  asset_type_id     uuid references public.asset_types(id) on delete set null,
  amc_contract_id   uuid references public.amc_contracts(id) on delete set null,

  name              text not null,
  manufacturer      text,
  model             text,
  serial_number     text,
  purchase_date     date,
  installation_date date,
  warranty_expiry   date,

  ip_address        inet,
  mac_address       macaddr,
  hostname          text,
  operating_system  text,

  location_detail   text,
  status            app.asset_status not null default 'IN_SERVICE',
  criticality       int not null default 3 check (criticality between 1 and 5),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint assets_serial_unique_per_customer unique (customer_id, serial_number)
);

create index if not exists idx_assets_customer on public.assets(customer_id);
create index if not exists idx_assets_branch   on public.assets(branch_id);
create index if not exists idx_assets_status   on public.assets(status);
create index if not exists idx_assets_warranty on public.assets(warranty_expiry);
create index if not exists idx_assets_serial_trgm
  on public.assets using gin (serial_number gin_trgm_ops);

-- Close the ticket -> asset link declared in 0006.
alter table public.tickets
  drop constraint if exists tickets_asset_fk,
  add  constraint tickets_asset_fk
       foreign key (asset_id) references public.assets(id) on delete set null;

create index if not exists idx_tickets_asset on public.tickets(asset_id);

select app.attach_touch_trigger('public.amc_contracts');
select app.attach_touch_trigger('public.assets');

-- ---------------------------------------------------------------------
-- Contract status is derived from dates. Recomputed by the scheduled job
-- and whenever a contract row is written.
-- ---------------------------------------------------------------------
create or replace function app.derive_amc_status(
  p_start  date,
  p_expiry date,
  p_current app.amc_status,
  p_notice_days int default 30
)
returns app.amc_status
language sql
immutable
as $$
  select case
    -- Manual states are never overridden by the date logic.
    when p_current in ('SUSPENDED', 'CANCELLED') then p_current
    when current_date > p_expiry                 then 'EXPIRED'::app.amc_status
    when current_date >= (p_expiry - p_notice_days) then 'EXPIRING'::app.amc_status
    else 'ACTIVE'::app.amc_status
  end
$$;

create or replace function app.amc_status_trigger()
returns trigger
language plpgsql
as $$
begin
  new.status := app.derive_amc_status(new.start_date, new.expiry_date, new.status, new.renewal_notice_days);
  return new;
end;
$$;

drop trigger if exists trg_amc_status on public.amc_contracts;
create trigger trg_amc_status
  before insert or update of start_date, expiry_date, renewal_notice_days, status
  on public.amc_contracts
  for each row execute function app.amc_status_trigger();

-- Called nightly to move contracts between ACTIVE / EXPIRING / EXPIRED.
create or replace function app.refresh_amc_statuses()
returns int
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_count int;
begin
  update public.amc_contracts c
     set status = app.derive_amc_status(c.start_date, c.expiry_date, c.status, c.renewal_notice_days),
         updated_at = now()
   where c.status not in ('SUSPENDED', 'CANCELLED')
     and c.status is distinct from
         app.derive_amc_status(c.start_date, c.expiry_date, c.status, c.renewal_notice_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

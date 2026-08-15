-- =====================================================================
-- RCT APPLICATION | Migration 0005 - Service catalogue, SLA plans,
--                    business calendar and system settings
-- =====================================================================

-- ---------------------------------------------------------------------
-- Categories / subcategories (fully admin-manageable)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique,
  name           text not null,
  description    text,
  icon           text,
  colour         text,                              -- hex, used by the UI
  sort_order     int  not null default 100,
  default_priority_id uuid,                         -- FK added below
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.subcategories (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories(id) on delete cascade,
  code         text not null,
  name         text not null,
  description  text,
  sort_order   int not null default 100,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint subcategories_code_unique unique (category_id, code)
);

create index if not exists idx_subcategories_category on public.subcategories(category_id);

-- ---------------------------------------------------------------------
-- Priorities. SLA targets live on sla_rules so a customer's plan can
-- override the platform default for the same priority.
-- ---------------------------------------------------------------------
create table if not exists public.priorities (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,               -- LOW / MEDIUM / HIGH / CRITICAL
  name          text not null,
  description   text,
  severity      int  not null unique,               -- 1 = least severe
  colour        text not null default '#64748b',
  is_default    boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Exactly one default priority.
create unique index if not exists uq_priorities_default
  on public.priorities((is_default)) where is_default;

alter table public.categories
  drop constraint if exists categories_default_priority_fk,
  add  constraint categories_default_priority_fk
       foreign key (default_priority_id) references public.priorities(id) on delete set null;

-- ---------------------------------------------------------------------
-- SLA plans and per-priority rules
-- ---------------------------------------------------------------------
create table if not exists public.sla_plans (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null,
  description       text,
  -- When true, SLA clocks run continuously. When false, they only run
  -- inside the configured business hours and stop on holidays.
  is_24x7           boolean not null default false,
  -- Whether time spent in ON_HOLD / PENDING_CUSTOMER pauses the clock.
  pause_on_hold     boolean not null default true,
  timezone          text not null default 'Asia/Dubai',
  -- Percentage of the target consumed before a ticket is flagged at risk.
  at_risk_threshold int not null default 80 check (at_risk_threshold between 1 and 99),
  is_default        boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists uq_sla_plans_default
  on public.sla_plans((is_default)) where is_default;

create table if not exists public.sla_rules (
  id                     uuid primary key default gen_random_uuid(),
  sla_plan_id            uuid not null references public.sla_plans(id) on delete cascade,
  priority_id            uuid not null references public.priorities(id) on delete cascade,
  response_minutes       int  not null check (response_minutes   > 0),
  resolution_minutes     int  not null check (resolution_minutes > 0),
  -- Optional escalation ladder.
  escalation_1_minutes   int check (escalation_1_minutes > 0),
  escalation_2_minutes   int check (escalation_2_minutes > 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint sla_rules_unique unique (sla_plan_id, priority_id),
  constraint sla_rules_resolution_after_response
    check (resolution_minutes >= response_minutes)
);

create index if not exists idx_sla_rules_priority on public.sla_rules(priority_id);

alter table public.customers
  drop constraint if exists customers_sla_plan_fk,
  add  constraint customers_sla_plan_fk
       foreign key (sla_plan_id) references public.sla_plans(id) on delete set null;

-- ---------------------------------------------------------------------
-- Business calendar
-- ---------------------------------------------------------------------
create table if not exists public.business_hours (
  id           uuid primary key default gen_random_uuid(),
  sla_plan_id  uuid references public.sla_plans(id) on delete cascade,
  -- ISO-8601 day of week: 1 = Monday ... 7 = Sunday
  day_of_week  int  not null check (day_of_week between 1 and 7),
  opens_at     time not null,
  closes_at    time not null,
  is_working_day boolean not null default true,
  created_at   timestamptz not null default now(),

  constraint business_hours_window check (closes_at > opens_at),
  constraint business_hours_unique unique (sla_plan_id, day_of_week)
);

create table if not exists public.holidays (
  id           uuid primary key default gen_random_uuid(),
  sla_plan_id  uuid references public.sla_plans(id) on delete cascade,
  holiday_date date not null,
  name         text not null,
  is_recurring boolean not null default false,
  created_at   timestamptz not null default now(),

  constraint holidays_unique unique (sla_plan_id, holiday_date)
);

create index if not exists idx_holidays_date on public.holidays(holiday_date);

-- ---------------------------------------------------------------------
-- System settings - a single typed key/value store.
-- `is_secret` values are never returned to the browser; the API layer
-- redacts them and only the server may read them.
-- ---------------------------------------------------------------------
create table if not exists public.system_settings (
  key         text primary key,
  value       jsonb not null,
  category    text  not null default 'general',
  label       text,
  description text,
  is_secret   boolean not null default false,
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

create index if not exists idx_system_settings_category on public.system_settings(category);

select app.attach_touch_trigger('public.categories');
select app.attach_touch_trigger('public.subcategories');
select app.attach_touch_trigger('public.priorities');
select app.attach_touch_trigger('public.sla_plans');
select app.attach_touch_trigger('public.sla_rules');

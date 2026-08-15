-- =====================================================================
-- RCT APPLICATION | Ram Computer Technology LLC
-- Migration 0001 - Foundation: extensions, schemas, enums, utilities
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "btree_gin";
create extension if not exists "citext";

-- Dedicated schema for application-internal helper routines.
-- Keeping helpers out of `public` prevents them being exposed through
-- the auto-generated REST API surface.
create schema if not exists app;

-- ---------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------

do $$ begin
  create type app.user_role as enum (
    'super_admin',
    'admin',
    'management',
    'service_manager',
    'engineer',
    'customer_admin',
    'customer_user'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.record_status as enum ('active', 'inactive', 'suspended', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.ticket_status as enum (
    'NEW',
    'ASSIGNED',
    'ACCEPTED',
    'IN_PROGRESS',
    'ON_SITE',
    'ON_HOLD',
    'PENDING_CUSTOMER',
    'PENDING_PARTS',
    'RESOLVED',
    'CLOSED',
    'REOPENED',
    'CANCELLED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.sla_state as enum ('met', 'at_risk', 'breached', 'not_applicable', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.amc_status as enum ('ACTIVE', 'EXPIRING', 'EXPIRED', 'SUSPENDED', 'CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.asset_status as enum ('IN_SERVICE', 'IN_REPAIR', 'STANDBY', 'RETIRED', 'DISPOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.email_status as enum ('queued', 'sending', 'sent', 'failed', 'bounced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.visit_stage as enum ('TRAVEL_STARTED', 'ARRIVED', 'WORK_STARTED', 'PAUSED', 'RESUMED', 'WORK_COMPLETED', 'DEPARTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app.customer_type as enum ('AMC', 'ON_CALL', 'PROJECT', 'WARRANTY', 'INTERNAL');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Convenience: attach the updated_at trigger to a table.
create or replace function app.attach_touch_trigger(p_table regclass)
returns void
language plpgsql
as $$
declare
  v_name text;
begin
  v_name := 'trg_touch_' || replace(p_table::text, '.', '_');
  execute format(
    'drop trigger if exists %I on %s', v_name, p_table
  );
  execute format(
    'create trigger %I before update on %s for each row execute function app.touch_updated_at()',
    v_name, p_table
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Document numbering (TKT-2026-000001 / SR-2026-000001 / AMC-2026-0001)
-- Configurable width + prefix, safe under concurrency.
-- ---------------------------------------------------------------------

create table if not exists public.number_sequences (
  scope        text        not null,
  period       text        not null,
  last_value   bigint      not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (scope, period)
);

comment on table public.number_sequences is
  'Monotonic counters backing human-readable document numbers, partitioned by scope and period (usually the year).';

create or replace function app.next_document_number(
  p_scope  text,
  p_prefix text,
  p_period text default to_char(now() at time zone 'Asia/Dubai', 'YYYY'),
  p_width  int  default 6
)
returns text
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_next bigint;
begin
  insert into public.number_sequences (scope, period, last_value)
  values (p_scope, p_period, 1)
  on conflict (scope, period)
  do update set last_value = public.number_sequences.last_value + 1,
                updated_at = now()
  returning last_value into v_next;

  return p_prefix || '-' || p_period || '-' || lpad(v_next::text, p_width, '0');
end;
$$;

comment on function app.next_document_number is
  'Allocates the next document number for a scope. The UPSERT holds a row lock for the duration of the statement, so concurrent callers serialise and can never receive the same number.';

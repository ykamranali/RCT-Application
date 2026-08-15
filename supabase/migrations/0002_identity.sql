-- =====================================================================
-- RCT APPLICATION | Migration 0002 - Identity, roles and permissions
-- =====================================================================

-- ---------------------------------------------------------------------
-- Roles catalogue (data-driven, so new roles do not require a deploy)
-- ---------------------------------------------------------------------
create table if not exists public.roles (
  id           uuid primary key default gen_random_uuid(),
  code         app.user_role not null unique,
  name         text          not null,
  description  text,
  rank         int           not null,          -- lower == more privileged
  is_staff     boolean       not null default false,
  is_system    boolean       not null default true,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

comment on column public.roles.rank is
  'Privilege ordering. A user may only ever administer roles with a strictly higher rank than their own.';

create table if not exists public.permissions (
  id           uuid primary key default gen_random_uuid(),
  code         text        not null unique,     -- e.g. 'ticket.assign'
  resource     text        not null,            -- e.g. 'ticket'
  action       text        not null,            -- e.g. 'assign'
  description  text,
  created_at   timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create index if not exists idx_role_permissions_permission on public.role_permissions(permission_id);

-- ---------------------------------------------------------------------
-- Profiles - one row per authenticated user, keyed to auth.users
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             citext,
  full_name         text        not null default '',
  phone             text,
  avatar_url        text,
  role              app.user_role not null default 'customer_user',
  -- Exactly one of employee_id / customer_id is expected to be set,
  -- depending on whether the principal is internal staff or a customer contact.
  employee_id       uuid,
  customer_id       uuid,
  branch_id         uuid,
  is_active         boolean     not null default true,
  must_change_password boolean  not null default false,
  locale            text        not null default 'en',
  timezone          text        not null default 'Asia/Dubai',
  last_login_at     timestamptz,
  last_login_ip     inet,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_profiles_role        on public.profiles(role);
create index if not exists idx_profiles_customer    on public.profiles(customer_id);
create index if not exists idx_profiles_employee    on public.profiles(employee_id);
create index if not exists idx_profiles_active      on public.profiles(is_active) where is_active;
create index if not exists idx_profiles_email_trgm  on public.profiles using gin (email gin_trgm_ops);

select app.attach_touch_trigger('public.roles');
select app.attach_touch_trigger('public.profiles');

-- ---------------------------------------------------------------------
-- Authorisation helpers.
--
-- These are SECURITY DEFINER so that reading `profiles` from inside an
-- RLS policy on `profiles` cannot recurse. They are STABLE so PostgreSQL
-- evaluates them once per statement rather than once per row.
-- ---------------------------------------------------------------------

create or replace function app.current_role()
returns app.user_role
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
$$;

create or replace function app.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select p.customer_id
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
$$;

create or replace function app.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select p.employee_id
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
$$;

-- Full platform control.
create or replace function app.is_admin()
returns boolean
language sql
stable
as $$
  select app.current_role() in ('super_admin', 'admin')
$$;

-- Company-wide operational visibility.
create or replace function app.is_management()
returns boolean
language sql
stable
as $$
  select app.current_role() in ('super_admin', 'admin', 'management', 'service_manager')
$$;

-- Any internal (non-customer) principal.
create or replace function app.is_staff()
returns boolean
language sql
stable
as $$
  select app.current_role() in
    ('super_admin', 'admin', 'management', 'service_manager', 'engineer')
$$;

create or replace function app.is_engineer()
returns boolean
language sql
stable
as $$
  select app.current_role() = 'engineer'
$$;

-- A customer_admin may act for every contact under their company;
-- a customer_user is scoped to what their company can see.
create or replace function app.is_customer_admin()
returns boolean
language sql
stable
as $$
  select app.current_role() = 'customer_admin'
$$;

create or replace function app.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.roles r          on r.code = pr.role
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions perm on perm.id = rp.permission_id
    where pr.id = auth.uid()
      and pr.is_active
      and perm.code = p_code
  )
$$;

comment on function app.has_permission is
  'Fine-grained permission check driven by the role_permissions table. Used by API routes in addition to the coarse role helpers.';

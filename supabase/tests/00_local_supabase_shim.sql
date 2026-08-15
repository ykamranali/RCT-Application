-- =====================================================================
-- LOCAL VERIFICATION SHIM - NOT PART OF THE PRODUCTION MIGRATIONS
--
-- Supabase provides the `auth` schema, `auth.users`, `auth.uid()` and the
-- `anon` / `authenticated` / `service_role` roles. This file recreates just
-- enough of that surface to run the real migrations, the RLS test suite and
-- the seed data against a plain PostgreSQL instance in CI or locally.
--
-- Never apply this to a Supabase project.
-- =====================================================================

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  raw_app_meta_data   jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Supabase exposes the current principal through request-scoped GUCs.
-- `request.jwt.claim.sub` is what auth.uid() reads.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

create or replace function auth.email()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;

-- Minimal storage surface so the storage policies in 0013 can be applied.
create table if not exists storage.buckets (
  id      text primary key,
  name    text not null,
  public  boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets(id) on delete cascade,
  name       text not null,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/')
$$;

-- Roles used by the RLS policies.
do $$ begin create role anon           nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated  nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role   nologin bypassrls; exception when duplicate_object then null; end $$;

grant usage on schema public  to anon, authenticated, service_role;
grant usage on schema auth    to anon, authenticated, service_role;
grant usage on schema storage to anon, authenticated, service_role;

-- Helper used by the test suite to impersonate a principal.
create or replace function auth.login_as(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

create or replace function auth.logout()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
end;
$$;

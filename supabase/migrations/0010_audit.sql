-- =====================================================================
-- RCT APPLICATION | Migration 0010 - Audit trail
-- =====================================================================

create table if not exists public.audit_logs (
  id             bigserial primary key,
  occurred_at    timestamptz not null default now(),
  actor_id       uuid references public.profiles(id) on delete set null,
  actor_name     text,
  actor_role     app.user_role,
  action         text not null,             -- insert | update | delete | login | export | ...
  entity_type    text not null,             -- tickets | customers | system_settings | ...
  entity_id      text,
  entity_label   text,                      -- human readable, e.g. TKT-2026-000123
  summary        text,
  changed_fields text[],
  old_values     jsonb,
  new_values     jsonb,
  ip_address     inet,
  user_agent     text,
  request_id     text
);

create index if not exists idx_audit_occurred on public.audit_logs(occurred_at desc);
create index if not exists idx_audit_actor    on public.audit_logs(actor_id);
create index if not exists idx_audit_entity   on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_action   on public.audit_logs(action);

comment on table public.audit_logs is
  'Append-only. There is no UPDATE or DELETE policy on this table for any role, so history cannot be rewritten through the API.';

-- ---------------------------------------------------------------------
-- Fields that must never be written into the audit payload.
-- ---------------------------------------------------------------------
create or replace function app.redact_sensitive(p jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(p, '{}'::jsonb)
       - 'password' - 'encrypted_password' - 'smtp_password'
       - 'access_token' - 'refresh_token' - 'service_role_key' - 'api_key'
$$;

-- ---------------------------------------------------------------------
-- Generic row-level audit trigger. Attach with:
--   create trigger trg_audit_x after insert or update or delete on <table>
--     for each row execute function app.audit_row('<entity_type>', '<label_column>');
-- ---------------------------------------------------------------------
create or replace function app.audit_row()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_entity   text := coalesce(tg_argv[0], tg_table_name);
  v_label_col text := tg_argv[1];
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_id   text;
  v_label text;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_actor_role app.user_role;
begin
  if tg_op = 'DELETE' then
    v_old := app.redact_sensitive(to_jsonb(old));
    v_new := null;
    v_id  := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'key');
  elsif tg_op = 'INSERT' then
    v_old := null;
    v_new := app.redact_sensitive(to_jsonb(new));
    v_id  := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key');
  else
    v_old := app.redact_sensitive(to_jsonb(old));
    v_new := app.redact_sensitive(to_jsonb(new));
    v_id  := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'key');

    select coalesce(array_agg(key order by key), '{}')
      into v_changed
      from jsonb_each(v_new) n(key, value)
     where n.value is distinct from (v_old -> n.key)
       and n.key <> 'updated_at';

    -- Nothing of substance changed - do not create noise.
    if v_changed = '{}' then
      return coalesce(new, old);
    end if;
  end if;

  if v_label_col is not null then
    v_label := coalesce(v_new, v_old) ->> v_label_col;
  end if;

  select p.full_name, p.role into v_actor_name, v_actor_role
  from public.profiles p where p.id = v_actor;

  insert into public.audit_logs
    (actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label,
     changed_fields, old_values, new_values, request_id)
  values
    (v_actor, v_actor_name, v_actor_role, lower(tg_op), v_entity, v_id, v_label,
     v_changed, v_old, v_new,
     nullif(current_setting('app.request_id', true), ''));

  return coalesce(new, old);
end;
$$;

-- Application-level events (login, export, PDF generated, email sent...)
create or replace function app.audit_event(
  p_action      text,
  p_entity_type text,
  p_entity_id   text default null,
  p_entity_label text default null,
  p_summary     text default null,
  p_metadata    jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_id bigint;
  v_name text;
  v_role app.user_role;
begin
  select p.full_name, p.role into v_name, v_role
  from public.profiles p where p.id = auth.uid();

  insert into public.audit_logs
    (actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, summary, new_values)
  values
    (auth.uid(), v_name, v_role, p_action, p_entity_type, p_entity_id, p_entity_label, p_summary,
     app.redact_sensitive(p_metadata))
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Attach auditing to the tables that matter
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('public.tickets',        'tickets',        'ticket_number'),
      ('public.customers',      'customers',      'company_name'),
      ('public.branches',       'branches',       'branch_name'),
      ('public.employees',      'employees',      'full_name'),
      ('public.profiles',       'profiles',       'email'),
      ('public.amc_contracts',  'amc_contracts',  'amc_number'),
      ('public.assets',         'assets',         'asset_tag'),
      ('public.service_reports','service_reports','report_number'),
      ('public.sla_plans',      'sla_plans',      'name'),
      ('public.sla_rules',      'sla_rules',      null),
      ('public.categories',     'categories',     'name'),
      ('public.priorities',     'priorities',     'name'),
      ('public.email_templates','email_templates','code'),
      ('public.system_settings','system_settings','key'),
      ('public.roles',          'roles',          'name')
    ) as t(tbl, entity, label)
  loop
    execute format('drop trigger if exists trg_audit_%s on %s', r.entity, r.tbl);
    if r.label is null then
      execute format(
        'create trigger trg_audit_%s after insert or update or delete on %s
           for each row execute function app.audit_row(%L)',
        r.entity, r.tbl, r.entity);
    else
      execute format(
        'create trigger trg_audit_%s after insert or update or delete on %s
           for each row execute function app.audit_row(%L, %L)',
        r.entity, r.tbl, r.entity, r.label);
    end if;
  end loop;
end $$;

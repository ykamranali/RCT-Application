-- =====================================================================
-- RCT APPLICATION | Migration 0009 - Notification centre and email
-- =====================================================================

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  type          text not null,          -- ticket.created | sla.warning | amc.expiring | ...
  title         text not null,
  body          text,
  severity      text not null default 'info' check (severity in ('info','success','warning','critical')),
  link_url      text,
  ticket_id     uuid references public.tickets(id) on delete cascade,
  metadata      jsonb not null default '{}'::jsonb,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_notifications_recipient
  on public.notifications(recipient_id, created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications(recipient_id) where read_at is null;

-- ---------------------------------------------------------------------
-- Email templates. Bodies use {{variable}} placeholders resolved by the
-- application's template renderer.
-- ---------------------------------------------------------------------
create table if not exists public.email_templates (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,   -- ticket_created | ticket_closed | sla_breached | ...
  name          text not null,
  description   text,
  subject       text not null,
  body_html     text not null,
  body_text     text,
  -- Documented placeholders, surfaced in the admin editor.
  variables     text[] not null default '{}',
  send_to_customer  boolean not null default true,
  send_to_engineer  boolean not null default false,
  send_to_management boolean not null default false,
  attach_report boolean not null default false,
  is_active     boolean not null default true,
  is_system     boolean not null default true,
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Outbound email log / queue. Every send attempt is recorded, which is
-- what the ticket timeline and the admin "delivery status" screen read.
-- ---------------------------------------------------------------------
create table if not exists public.email_logs (
  id              uuid primary key default gen_random_uuid(),
  template_code   text,
  ticket_id       uuid references public.tickets(id) on delete set null,
  service_report_id uuid references public.service_reports(id) on delete set null,
  to_addresses    text[] not null check (cardinality(to_addresses) > 0),
  cc_addresses    text[] not null default '{}',
  bcc_addresses   text[] not null default '{}',
  from_address    text,
  reply_to        text,
  subject         text not null,
  body_preview    text,
  attachments     jsonb not null default '[]'::jsonb,
  provider        text,                    -- smtp | resend
  provider_message_id text,
  status          app.email_status not null default 'queued',
  attempts        int not null default 0 check (attempts >= 0),
  last_error      text,
  queued_at       timestamptz not null default now(),
  sent_at         timestamptz,
  created_by      uuid references public.profiles(id) on delete set null
);

create index if not exists idx_email_logs_ticket on public.email_logs(ticket_id);
create index if not exists idx_email_logs_status on public.email_logs(status);
create index if not exists idx_email_logs_queued on public.email_logs(queued_at desc);

select app.attach_touch_trigger('public.email_templates');

-- ---------------------------------------------------------------------
-- Notification fan-out helper. Used by the workflow triggers in 0011.
-- ---------------------------------------------------------------------
create or replace function app.notify_profiles(
  p_recipients uuid[],
  p_type       text,
  p_title      text,
  p_body       text default null,
  p_severity   text default 'info',
  p_ticket_id  uuid default null,
  p_link_url   text default null,
  p_metadata   jsonb default '{}'::jsonb
)
returns int
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_count int;
begin
  insert into public.notifications
    (recipient_id, type, title, body, severity, ticket_id, link_url, metadata)
  select distinct r, p_type, p_title, p_body, p_severity, p_ticket_id, p_link_url, p_metadata
  from unnest(p_recipients) as r
  where r is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Everyone who should hear about operational events on a ticket.
create or replace function app.ticket_watchers(p_ticket_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select coalesce(array_agg(distinct pid), '{}')
  from (
    -- assigned engineer
    select e.profile_id as pid
    from public.tickets t
    join public.employees e on e.id = t.assigned_engineer_id
    where t.id = p_ticket_id
    union
    -- service manager
    select e.profile_id
    from public.tickets t
    join public.employees e on e.id = t.service_manager_id
    where t.id = p_ticket_id
    union
    -- every management / admin principal
    select p.id
    from public.profiles p
    where p.is_active
      and p.role in ('super_admin', 'admin', 'management', 'service_manager')
  ) s
  where pid is not null
$$;

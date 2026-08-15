-- =====================================================================
-- RCT APPLICATION | Migration 0006 - Tickets and the service workflow
-- =====================================================================

create table if not exists public.tickets (
  id                    uuid primary key default gen_random_uuid(),
  ticket_number         text not null unique,       -- TKT-2026-000001

  -- Who it is for -----------------------------------------------------
  customer_id           uuid not null references public.customers(id) on delete restrict,
  branch_id             uuid references public.branches(id) on delete set null,
  asset_id              uuid,                        -- FK added in 0008
  contact_person        text,
  contact_phone         text,
  contact_email         citext,

  -- What it is --------------------------------------------------------
  category_id           uuid references public.categories(id)    on delete set null,
  subcategory_id        uuid references public.subcategories(id) on delete set null,
  priority_id           uuid not null references public.priorities(id) on delete restrict,
  subject               text not null check (length(btrim(subject)) between 3 and 200),
  description           text not null check (length(btrim(description)) >= 10),
  status                app.ticket_status not null default 'NEW',

  -- Who is working it -------------------------------------------------
  created_by            uuid references public.profiles(id)  on delete set null,
  assigned_engineer_id  uuid references public.employees(id) on delete set null,
  service_manager_id    uuid references public.employees(id) on delete set null,

  -- Lifecycle timestamps ----------------------------------------------
  created_at            timestamptz not null default now(),
  assigned_at           timestamptz,
  accepted_at           timestamptz,
  first_response_at     timestamptz,
  work_started_at       timestamptz,
  on_site_at            timestamptz,
  resolved_at           timestamptz,
  closed_at             timestamptz,
  reopened_at           timestamptz,
  cancelled_at          timestamptz,
  updated_at            timestamptz not null default now(),

  preferred_visit_at    timestamptz,

  -- SLA ---------------------------------------------------------------
  sla_plan_id           uuid references public.sla_plans(id) on delete set null,
  response_due_at       timestamptz,
  resolution_due_at     timestamptz,
  response_state        app.sla_state not null default 'pending',
  resolution_state      app.sla_state not null default 'pending',
  -- Accumulated milliseconds the SLA clock was paused (ON_HOLD etc.).
  paused_ms             bigint not null default 0 check (paused_ms >= 0),
  paused_since          timestamptz,

  -- Outcome -----------------------------------------------------------
  diagnosis             text,
  work_performed        text,
  resolution_summary    text,
  engineer_remarks      text,
  customer_remarks      text,
  root_cause            text,
  cancellation_reason   text,
  reopen_count          int not null default 0 check (reopen_count >= 0),
  is_billable           boolean not null default false,

  -- Denormalised search vector, maintained by trigger in 0011.
  search_text           text,

  constraint tickets_resolved_requires_summary check (
    status not in ('RESOLVED', 'CLOSED')
    or (resolution_summary is not null and length(btrim(resolution_summary)) >= 10)
  ),
  constraint tickets_closed_requires_resolved_at check (
    status <> 'CLOSED' or resolved_at is not null
  ),
  constraint tickets_cancel_requires_reason check (
    status <> 'CANCELLED' or (cancellation_reason is not null and length(btrim(cancellation_reason)) > 0)
  )
);

comment on constraint tickets_resolved_requires_summary on public.tickets is
  'A ticket can never reach RESOLVED or CLOSED without a resolution summary. Enforced in the database so no API path can bypass it.';

create index if not exists idx_tickets_customer     on public.tickets(customer_id);
create index if not exists idx_tickets_branch       on public.tickets(branch_id);
create index if not exists idx_tickets_engineer     on public.tickets(assigned_engineer_id);
create index if not exists idx_tickets_manager      on public.tickets(service_manager_id);
create index if not exists idx_tickets_status       on public.tickets(status);
create index if not exists idx_tickets_priority     on public.tickets(priority_id);
create index if not exists idx_tickets_category     on public.tickets(category_id);
create index if not exists idx_tickets_created_at   on public.tickets(created_at desc);
create index if not exists idx_tickets_resolution_due on public.tickets(resolution_due_at)
  where status not in ('CLOSED', 'CANCELLED', 'RESOLVED');
create index if not exists idx_tickets_open
  on public.tickets(customer_id, status)
  where status not in ('CLOSED', 'CANCELLED');
create index if not exists idx_tickets_number_trgm
  on public.tickets using gin (ticket_number gin_trgm_ops);
create index if not exists idx_tickets_search_trgm
  on public.tickets using gin (search_text gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Immutable status history == the ticket timeline
-- ---------------------------------------------------------------------
create table if not exists public.ticket_status_history (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets(id) on delete cascade,
  from_status   app.ticket_status,
  to_status     app.ticket_status not null,
  event_type    text not null default 'status_change',
  note          text,
  changed_by    uuid references public.profiles(id) on delete set null,
  changed_by_name text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_status_history_ticket
  on public.ticket_status_history(ticket_id, created_at);

-- ---------------------------------------------------------------------
-- Assignment history (who held the ticket, and when)
-- ---------------------------------------------------------------------
create table if not exists public.ticket_assignments (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets(id)   on delete cascade,
  engineer_id   uuid not null references public.employees(id) on delete cascade,
  assigned_by   uuid references public.profiles(id) on delete set null,
  assigned_at   timestamptz not null default now(),
  accepted_at   timestamptz,
  released_at   timestamptz,
  is_current    boolean not null default true,
  reason        text
);

create index if not exists idx_ticket_assignments_ticket   on public.ticket_assignments(ticket_id);
create index if not exists idx_ticket_assignments_engineer on public.ticket_assignments(engineer_id);
create unique index if not exists uq_ticket_current_assignment
  on public.ticket_assignments(ticket_id) where is_current;

-- ---------------------------------------------------------------------
-- Comments. `is_internal` comments are never visible to customers -
-- this is enforced by RLS, not by the UI.
-- ---------------------------------------------------------------------
create table if not exists public.ticket_comments (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.tickets(id) on delete cascade,
  author_id    uuid references public.profiles(id) on delete set null,
  author_name  text,
  author_role  app.user_role,
  body         text not null check (length(btrim(body)) > 0),
  is_internal  boolean not null default false,
  is_system    boolean not null default false,
  edited_at    timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_ticket_comments_ticket
  on public.ticket_comments(ticket_id, created_at);
create index if not exists idx_ticket_comments_public
  on public.ticket_comments(ticket_id) where not is_internal;

-- ---------------------------------------------------------------------
-- Attachments (metadata; bytes live in Supabase Storage)
-- ---------------------------------------------------------------------
create table if not exists public.ticket_attachments (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets(id) on delete cascade,
  storage_path  text not null unique,
  file_name     text not null,
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 26214400), -- 25 MB
  kind          text not null default 'attachment',  -- attachment | before_photo | after_photo | signature | report
  uploaded_by   uuid references public.profiles(id) on delete set null,
  is_internal   boolean not null default false,
  scan_status   text not null default 'pending',     -- pending | clean | infected | skipped
  created_at    timestamptz not null default now(),

  constraint ticket_attachments_mime_allowed check (
    mime_type in (
      'image/jpeg','image/jpg','image/png','image/webp','application/pdf','text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/msword','application/vnd.ms-excel'
    )
  )
);

create index if not exists idx_ticket_attachments_ticket on public.ticket_attachments(ticket_id);

-- ---------------------------------------------------------------------
-- Parts and materials consumed
-- ---------------------------------------------------------------------
create table if not exists public.parts_catalogue (
  id           uuid primary key default gen_random_uuid(),
  part_code    text not null unique,
  name         text not null,
  description  text,
  unit         text not null default 'pcs',
  unit_cost    numeric(12,2) check (unit_cost >= 0),
  currency     char(3) not null default 'AED',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.ticket_parts (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets(id) on delete cascade,
  part_id       uuid references public.parts_catalogue(id) on delete set null,
  part_name     text not null,
  serial_number text,
  quantity      numeric(12,3) not null check (quantity > 0),
  unit          text not null default 'pcs',
  unit_cost     numeric(12,2) check (unit_cost >= 0),
  currency      char(3) not null default 'AED',
  is_billable   boolean not null default true,
  is_replacement boolean not null default false,
  remarks       text,
  recorded_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),

  -- Stored generated column so cost roll-ups never drift.
  total_cost    numeric(14,2)
    generated always as (round(coalesce(unit_cost, 0) * quantity, 2)) stored
);

create index if not exists idx_ticket_parts_ticket on public.ticket_parts(ticket_id);
create index if not exists idx_ticket_parts_part   on public.ticket_parts(part_id);

-- ---------------------------------------------------------------------
-- Labour time entries
-- ---------------------------------------------------------------------
create table if not exists public.ticket_time_entries (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets(id)   on delete cascade,
  engineer_id   uuid not null references public.employees(id) on delete cascade,
  started_at    timestamptz not null,
  ended_at      timestamptz,
  activity      text not null default 'onsite',   -- onsite | remote | travel | workshop
  is_overtime   boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),

  constraint time_entry_window check (ended_at is null or ended_at >= started_at),

  minutes_spent int generated always as (
    case when ended_at is null then null
         else greatest(0, (extract(epoch from (ended_at - started_at)) / 60)::int)
    end
  ) stored
);

create index if not exists idx_time_entries_ticket   on public.ticket_time_entries(ticket_id);
create index if not exists idx_time_entries_engineer on public.ticket_time_entries(engineer_id, started_at);

-- Only one open (un-ended) time entry per engineer at a time.
create unique index if not exists uq_time_entry_open_per_engineer
  on public.ticket_time_entries(engineer_id) where ended_at is null;

-- ---------------------------------------------------------------------
-- Site visits
-- ---------------------------------------------------------------------
create table if not exists public.ticket_visits (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets(id)   on delete cascade,
  engineer_id   uuid not null references public.employees(id) on delete cascade,
  stage         app.visit_stage not null,
  occurred_at   timestamptz not null default now(),
  latitude      numeric(9,6),
  longitude     numeric(9,6),
  accuracy_m    numeric(8,2),
  notes         text,
  created_at    timestamptz not null default now(),

  constraint ticket_visits_latitude_range  check (latitude  is null or latitude  between -90  and 90),
  constraint ticket_visits_longitude_range check (longitude is null or longitude between -180 and 180)
);

create index if not exists idx_ticket_visits_ticket on public.ticket_visits(ticket_id, occurred_at);

comment on table public.ticket_visits is
  'Discrete, engineer-initiated location checkpoints. Coordinates are only recorded when the engineer explicitly performs a stage transition - there is no background tracking.';

select app.attach_touch_trigger('public.tickets');
select app.attach_touch_trigger('public.parts_catalogue');

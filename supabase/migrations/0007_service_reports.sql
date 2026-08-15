-- =====================================================================
-- RCT APPLICATION | Migration 0007 - Service reports, signatures,
--                    customer approval and feedback
-- =====================================================================

create table if not exists public.service_reports (
  id                 uuid primary key default gen_random_uuid(),
  report_number      text not null unique,          -- SR-2026-000001
  ticket_id          uuid not null references public.tickets(id) on delete cascade,
  customer_id        uuid not null references public.customers(id) on delete restrict,
  branch_id          uuid references public.branches(id) on delete set null,
  engineer_id        uuid references public.employees(id) on delete set null,

  -- Point-in-time snapshot of everything printed on the PDF. Kept
  -- denormalised on purpose: a signed service report must never change
  -- because someone later renamed a customer or edited a category.
  snapshot           jsonb not null default '{}'::jsonb,

  complaint_summary  text,
  diagnosis          text,
  work_performed     text,
  engineer_remarks   text,
  customer_remarks   text,
  parts_summary      jsonb not null default '[]'::jsonb,

  service_started_at   timestamptz,
  arrival_at           timestamptz,
  completion_at        timestamptz,
  total_minutes        int check (total_minutes >= 0),

  customer_signature_id uuid,                      -- FK added below
  engineer_signature_id uuid,
  customer_signed_name  text,
  engineer_signed_name  text,

  storage_path       text unique,                  -- PDF location in Storage
  file_size_bytes    bigint check (file_size_bytes is null or file_size_bytes > 0),
  pdf_generated_at   timestamptz,
  pdf_version        int not null default 1 check (pdf_version >= 1),

  final_status       app.ticket_status not null default 'RESOLVED',
  is_approved        boolean not null default false,
  approved_at        timestamptz,
  approved_by        uuid references public.profiles(id) on delete set null,

  generated_by       uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_service_reports_ticket   on public.service_reports(ticket_id);
create index if not exists idx_service_reports_customer on public.service_reports(customer_id);
create index if not exists idx_service_reports_engineer on public.service_reports(engineer_id);
create index if not exists idx_service_reports_created  on public.service_reports(created_at desc);

-- ---------------------------------------------------------------------
-- Digital signatures. The image itself is held in a private Storage
-- bucket; the hash lets us prove the stored image is the one that was
-- signed and embedded in the PDF.
-- ---------------------------------------------------------------------
create table if not exists public.customer_signatures (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.tickets(id) on delete cascade,
  signer_type    text not null default 'customer' check (signer_type in ('customer', 'engineer')),
  signer_name    text not null check (length(btrim(signer_name)) > 0),
  signer_title   text,
  signer_email   citext,
  storage_path   text not null unique,
  content_hash   text not null,                    -- sha256 of the PNG bytes
  signed_at      timestamptz not null default now(),
  captured_by    uuid references public.profiles(id) on delete set null,
  ip_address     inet,
  user_agent     text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_customer_signatures_ticket on public.customer_signatures(ticket_id);

alter table public.service_reports
  drop constraint if exists service_reports_customer_signature_fk,
  add  constraint service_reports_customer_signature_fk
       foreign key (customer_signature_id) references public.customer_signatures(id) on delete set null;

alter table public.service_reports
  drop constraint if exists service_reports_engineer_signature_fk,
  add  constraint service_reports_engineer_signature_fk
       foreign key (engineer_signature_id) references public.customer_signatures(id) on delete set null;

-- ---------------------------------------------------------------------
-- Customer feedback / CSAT
-- ---------------------------------------------------------------------
create table if not exists public.customer_feedback (
  id                 uuid primary key default gen_random_uuid(),
  ticket_id          uuid not null references public.tickets(id) on delete cascade,
  customer_id        uuid not null references public.customers(id) on delete cascade,
  engineer_id        uuid references public.employees(id) on delete set null,
  submitted_by       uuid references public.profiles(id) on delete set null,

  issue_resolved     boolean,
  overall_rating     int not null check (overall_rating  between 1 and 5),
  engineer_rating    int check (engineer_rating between 1 and 5),
  service_rating     int check (service_rating  between 1 and 5),
  response_rating    int check (response_rating between 1 and 5),
  comments           text,

  requested_at       timestamptz,
  submitted_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),

  constraint customer_feedback_one_per_ticket unique (ticket_id)
);

create index if not exists idx_customer_feedback_engineer on public.customer_feedback(engineer_id);
create index if not exists idx_customer_feedback_customer on public.customer_feedback(customer_id);
create index if not exists idx_customer_feedback_rating   on public.customer_feedback(overall_rating);

-- ---------------------------------------------------------------------
-- Explicit customer approval of completed work
-- ---------------------------------------------------------------------
create table if not exists public.work_approvals (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.tickets(id) on delete cascade,
  requested_by   uuid references public.profiles(id) on delete set null,
  requested_at   timestamptz not null default now(),
  decided_by     uuid references public.profiles(id) on delete set null,
  decided_at     timestamptz,
  decision       text check (decision in ('approved', 'rejected')),
  comments       text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_work_approvals_ticket on public.work_approvals(ticket_id);

select app.attach_touch_trigger('public.service_reports');

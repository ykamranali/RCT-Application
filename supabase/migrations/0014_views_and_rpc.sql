-- =====================================================================
-- RCT APPLICATION | Migration 0014 - Reporting views and RPCs
--
-- Every view is declared security_invoker so that RLS on the underlying
-- tables still applies. Without this, a view would run as its owner and
-- silently become a tenant-isolation bypass.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Denormalised ticket view used by every list screen and export
-- ---------------------------------------------------------------------
-- Dropped first so the column list can change: CREATE OR REPLACE VIEW can
-- only append columns, never reorder or insert them.
drop view if exists public.v_tickets_overview;

create view public.v_tickets_overview
with (security_invoker = true) as
select
  t.id,
  t.ticket_number,
  t.subject,
  t.description,
  t.status,
  t.created_at,
  t.assigned_at,
  t.accepted_at,
  t.first_response_at,
  t.resolved_at,
  t.closed_at,
  t.reopened_at,
  t.reopen_count,
  t.preferred_visit_at,
  t.resolution_summary,
  t.diagnosis,
  t.work_performed,
  t.engineer_remarks,
  t.customer_remarks,
  t.is_billable,

  t.customer_id,
  c.company_name              as customer_name,
  c.customer_code,
  t.branch_id,
  b.branch_name,
  b.city                      as branch_city,
  b.emirate                   as branch_emirate,

  -- Site contact captured on the ticket; the detail screen shows these so
  -- the engineer knows who to ask for on arrival.
  t.contact_person,
  t.contact_phone,
  t.contact_email,

  t.category_id,
  cat.name                    as category_name,
  cat.colour                  as category_colour,
  t.subcategory_id,
  sub.name                    as subcategory_name,

  t.priority_id,
  pr.code                     as priority_code,
  pr.name                     as priority_name,
  pr.severity                 as priority_severity,
  pr.colour                   as priority_colour,

  t.assigned_engineer_id,
  eng.full_name               as engineer_name,
  eng.employee_code           as engineer_code,
  t.service_manager_id,
  mgr.full_name               as service_manager_name,

  t.asset_id,
  a.asset_tag,
  a.name                      as asset_name,

  t.sla_plan_id,
  t.response_due_at,
  t.resolution_due_at,
  t.response_state,
  t.resolution_state,
  t.paused_since is not null  as sla_paused,

  -- Minutes remaining against the resolution target (negative == overdue)
  case when t.resolved_at is not null or t.resolution_due_at is null then null
       else round(extract(epoch from (t.resolution_due_at - now())) / 60.0, 1)
  end                         as resolution_remaining_minutes,

  -- Whole-lifecycle durations, in minutes
  case when t.first_response_at is null then null
       else round(extract(epoch from (t.first_response_at - t.created_at)) / 60.0, 1)
  end                         as response_minutes_actual,
  case when t.resolved_at is null then null
       else round(extract(epoch from (t.resolved_at - t.created_at)) / 60.0, 1)
  end                         as resolution_minutes_actual,

  sr.id                       as service_report_id,
  sr.report_number,
  sr.storage_path             as service_report_path,

  fb.overall_rating           as customer_rating,

  (select count(*) from public.ticket_comments cm
    where cm.ticket_id = t.id and not cm.is_internal)      as public_comment_count,
  (select count(*) from public.ticket_attachments at2
    where at2.ticket_id = t.id)                            as attachment_count
from public.tickets t
left join public.customers     c   on c.id   = t.customer_id
left join public.branches      b   on b.id   = t.branch_id
left join public.categories    cat on cat.id = t.category_id
left join public.subcategories sub on sub.id = t.subcategory_id
left join public.priorities    pr  on pr.id  = t.priority_id
left join public.employees     eng on eng.id = t.assigned_engineer_id
left join public.employees     mgr on mgr.id = t.service_manager_id
left join public.assets        a   on a.id   = t.asset_id
left join lateral (
  select s.id, s.report_number, s.storage_path
  from public.service_reports s
  where s.ticket_id = t.id
  order by s.created_at desc
  limit 1
) sr on true
left join public.customer_feedback fb on fb.ticket_id = t.id;

-- ---------------------------------------------------------------------
-- Engineer performance, aggregated per engineer per calendar month
-- (Asia/Dubai months, so a report for "August" matches the business.)
-- ---------------------------------------------------------------------
create or replace view public.v_engineer_performance
with (security_invoker = true) as
select
  e.id                                    as engineer_id,
  e.employee_code,
  e.full_name                             as engineer_name,
  date_trunc('month', t.created_at at time zone 'Asia/Dubai')::date as period_month,

  count(*)                                                          as tickets_assigned,
  count(*) filter (where t.accepted_at is not null)                 as tickets_accepted,
  count(*) filter (where t.status in ('RESOLVED','CLOSED'))         as tickets_completed,
  count(*) filter (where t.status not in ('RESOLVED','CLOSED','CANCELLED')) as tickets_open,
  count(*) filter (where t.status = 'CANCELLED')                    as tickets_cancelled,
  count(*) filter (where t.reopen_count > 0)                        as tickets_reopened,

  count(*) filter (where t.response_state   = 'met')                as response_sla_met,
  count(*) filter (where t.response_state   = 'breached')           as response_sla_breached,
  count(*) filter (where t.resolution_state = 'met')                as resolution_sla_met,
  count(*) filter (where t.resolution_state = 'breached')           as resolution_sla_breached,

  round(
    100.0 * count(*) filter (where t.resolution_state = 'met')
    / nullif(count(*) filter (where t.resolution_state in ('met','breached')), 0)
  , 1)                                                              as sla_compliance_percent,

  round(avg(extract(epoch from (t.first_response_at - t.created_at)) / 60.0)
        filter (where t.first_response_at is not null), 1)          as avg_response_minutes,
  round(avg(extract(epoch from (t.resolved_at - t.created_at)) / 60.0)
        filter (where t.resolved_at is not null), 1)                as avg_resolution_minutes,

  count(*) filter (where sv.arrived)                                as site_visits,

  round(avg(fb.overall_rating) filter (where fb.overall_rating is not null), 2) as avg_customer_rating,
  count(fb.id)                                                      as feedback_count,
  count(fb.id) filter (where fb.overall_rating <= 2)                as poor_ratings,

  coalesce(sum(te.minutes_spent), 0)                                as labour_minutes,
  coalesce(sum(te.minutes_spent) filter (where te.is_overtime), 0)  as overtime_minutes,
  coalesce(sum(tp.total_cost), 0)                                   as parts_cost
from public.employees e
join public.tickets t on t.assigned_engineer_id = e.id
left join public.customer_feedback fb on fb.ticket_id = t.id
left join lateral (
  select sum(x.minutes_spent) as minutes_spent,
         bool_or(x.is_overtime) as is_overtime
  from public.ticket_time_entries x
  where x.ticket_id = t.id and x.engineer_id = e.id
) te on true
left join lateral (
  select sum(p.total_cost) as total_cost
  from public.ticket_parts p where p.ticket_id = t.id
) tp on true
left join lateral (
  select exists (
    select 1 from public.ticket_visits v
    where v.ticket_id = t.id and v.engineer_id = e.id and v.stage = 'ARRIVED'
  ) as arrived
) sv on true
group by e.id, e.employee_code, e.full_name,
         date_trunc('month', t.created_at at time zone 'Asia/Dubai');

-- ---------------------------------------------------------------------
-- Customer summary for the management portal
-- ---------------------------------------------------------------------
create or replace view public.v_customer_summary
with (security_invoker = true) as
select
  c.id                as customer_id,
  c.customer_code,
  c.company_name,
  c.customer_type,
  c.status,
  c.amc_expiry_date,
  count(t.id)                                                          as total_tickets,
  count(t.id) filter (where t.status not in ('CLOSED','CANCELLED'))     as open_tickets,
  count(t.id) filter (where t.status in ('RESOLVED','CLOSED'))          as completed_tickets,
  count(t.id) filter (where t.resolution_state = 'breached')            as sla_breaches,
  count(t.id) filter (where t.reopen_count > 0)                         as reopened_tickets,
  round(avg(extract(epoch from (t.resolved_at - t.created_at)) / 3600.0)
        filter (where t.resolved_at is not null), 2)                    as avg_resolution_hours,
  round(avg(fb.overall_rating), 2)                                      as avg_rating,
  (select count(*) from public.branches b where b.customer_id = c.id)   as branch_count,
  (select count(*) from public.assets  a where a.customer_id = c.id)    as asset_count,
  (select count(*) from public.amc_contracts m
     where m.customer_id = c.id and m.status = 'ACTIVE')                as active_contracts
from public.customers c
left join public.tickets t on t.customer_id = c.id
left join public.customer_feedback fb on fb.ticket_id = t.id
group by c.id, c.customer_code, c.company_name, c.customer_type, c.status, c.amc_expiry_date;

-- ---------------------------------------------------------------------
-- AMC contracts approaching expiry
-- ---------------------------------------------------------------------
create or replace view public.v_amc_expiring
with (security_invoker = true) as
select
  m.id, m.amc_number, m.customer_id, c.company_name, m.contract_type,
  m.start_date, m.expiry_date, m.contract_value, m.currency, m.status,
  (m.expiry_date - current_date) as days_remaining,
  case
    when m.expiry_date <  current_date       then 'expired'
    when m.expiry_date <= current_date + 30  then 'within_30_days'
    when m.expiry_date <= current_date + 60  then 'within_60_days'
    when m.expiry_date <= current_date + 90  then 'within_90_days'
    else 'later'
  end as expiry_bucket
from public.amc_contracts m
join public.customers c on c.id = m.customer_id
where m.status not in ('CANCELLED');

-- =====================================================================
-- RPCs
-- =====================================================================

-- ---------------------------------------------------------------------
-- Customer-initiated reopen. Customers have no UPDATE policy on tickets,
-- so this is the only path - and it validates ownership and eligibility.
-- ---------------------------------------------------------------------
create or replace function public.customer_reopen_ticket(
  p_ticket_id uuid,
  p_reason    text
)
returns public.tickets
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_ticket public.tickets;
  v_window int;
begin
  if p_reason is null or length(btrim(p_reason)) < 10 then
    raise exception 'Please describe why this ticket should be reopened (at least 10 characters)'
      using errcode = 'check_violation';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found' using errcode = 'no_data_found';
  end if;

  if v_ticket.customer_id is distinct from app.current_customer_id() then
    raise exception 'You do not have access to this ticket' using errcode = 'insufficient_privilege';
  end if;

  if v_ticket.status not in ('RESOLVED', 'CLOSED') then
    raise exception 'Only a resolved or closed ticket can be reopened' using errcode = 'check_violation';
  end if;

  v_window := coalesce(nullif(app.setting_text('reopen_window_days', '14'), '')::int, 14);
  if coalesce(v_ticket.closed_at, v_ticket.resolved_at) < now() - make_interval(days => v_window) then
    raise exception 'This ticket can no longer be reopened (the % day window has passed). Please raise a new ticket.', v_window
      using errcode = 'check_violation';
  end if;

  update public.tickets
     set status = 'REOPENED',
         customer_remarks = concat_ws(E'\n', customer_remarks, 'Reopened: ' || p_reason)
   where id = p_ticket_id
   returning * into v_ticket;

  insert into public.ticket_comments (ticket_id, author_id, author_name, author_role, body, is_internal)
  select p_ticket_id, auth.uid(), pr.full_name, pr.role, 'Reopen requested: ' || p_reason, false
  from public.profiles pr where pr.id = auth.uid();

  return v_ticket;
end;
$$;

-- ---------------------------------------------------------------------
-- Customer approval / rejection of completed work
-- ---------------------------------------------------------------------
create or replace function public.customer_decide_work(
  p_ticket_id uuid,
  p_approved  boolean,
  p_comments  text default null
)
returns public.work_approvals
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_row public.work_approvals;
  v_customer uuid;
begin
  select t.customer_id into v_customer from public.tickets t where t.id = p_ticket_id;
  if v_customer is null then
    raise exception 'Ticket not found' using errcode = 'no_data_found';
  end if;
  if v_customer is distinct from app.current_customer_id() then
    raise exception 'You do not have access to this ticket' using errcode = 'insufficient_privilege';
  end if;

  if not p_approved and (p_comments is null or length(btrim(p_comments)) < 5) then
    raise exception 'Please tell us what still needs attention' using errcode = 'check_violation';
  end if;

  insert into public.work_approvals (ticket_id, decided_by, decided_at, decision, comments)
  values (p_ticket_id, auth.uid(), now(),
          case when p_approved then 'approved' else 'rejected' end, p_comments)
  returning * into v_row;

  insert into public.ticket_status_history
    (ticket_id, to_status, event_type, note, changed_by, changed_by_name)
  select p_ticket_id, t.status,
         case when p_approved then 'approval' else 'rejection' end,
         case when p_approved then 'Customer confirmed the work'
              else 'Customer rejected the work: ' || coalesce(p_comments, '') end,
         auth.uid(),
         (select full_name from public.profiles where id = auth.uid())
  from public.tickets t where t.id = p_ticket_id;

  -- A rejection sends the ticket back to the engineer.
  if not p_approved then
    update public.tickets set status = 'IN_PROGRESS'
     where id = p_ticket_id and status = 'RESOLVED';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- Engineer accepts an assignment
-- ---------------------------------------------------------------------
create or replace function public.engineer_accept_ticket(p_ticket_id uuid)
returns public.tickets
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_ticket public.tickets;
  v_emp uuid := app.current_employee_id();
begin
  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found' using errcode = 'no_data_found';
  end if;
  if v_ticket.assigned_engineer_id is distinct from v_emp then
    raise exception 'This ticket is not assigned to you' using errcode = 'insufficient_privilege';
  end if;
  if v_ticket.status not in ('ASSIGNED', 'REOPENED', 'NEW') then
    raise exception 'This ticket cannot be accepted from its current status (%)', v_ticket.status
      using errcode = 'check_violation';
  end if;

  update public.tickets
     set status = 'ACCEPTED', accepted_at = now()
   where id = p_ticket_id
   returning * into v_ticket;

  update public.ticket_assignments
     set accepted_at = now()
   where ticket_id = p_ticket_id and is_current;

  return v_ticket;
end;
$$;

-- ---------------------------------------------------------------------
-- PostgREST only exposes the `public` schema, so the permission check
-- needs a thin public wrapper for the API layer to call.
-- ---------------------------------------------------------------------
create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security invoker
set search_path = public, app, pg_temp
as $$
  select app.has_permission(p_code)
$$;

create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$
  select coalesce(array_agg(perm.code order by perm.code), '{}')
  from public.profiles pr
  join public.roles r             on r.code = pr.role
  join public.role_permissions rp on rp.role_id = r.id
  join public.permissions perm    on perm.id = rp.permission_id
  where pr.id = auth.uid()
    and pr.is_active
$$;

-- ---------------------------------------------------------------------
-- Notification helpers
-- ---------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare v_count int;
begin
  update public.notifications
     set read_at = now()
   where recipient_id = auth.uid()
     and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.unread_notification_count()
returns int
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select count(*)::int from public.notifications
  where recipient_id = auth.uid() and read_at is null
$$;

-- ---------------------------------------------------------------------
-- Global search. Results are already tenant-filtered because every
-- branch of the union reads through a security_invoker view or applies
-- the same visibility predicates used by RLS.
-- ---------------------------------------------------------------------
create or replace function public.global_search(p_query text, p_limit int default 20)
returns table (
  kind      text,
  id        uuid,
  label     text,
  sublabel  text,
  url       text,
  rank      real
)
language sql
stable
security invoker
set search_path = public, app, pg_temp
as $$
  with q as (select lower(btrim(p_query)) as term)
  (
    select 'ticket', t.id, t.ticket_number, t.subject, '/tickets/' || t.id,
           greatest(similarity(t.ticket_number, q.term), similarity(coalesce(t.subject,''), q.term))
    from public.tickets t, q
    where t.search_text like '%' || q.term || '%'
       or t.ticket_number ilike '%' || p_query || '%'
    order by 6 desc
    limit p_limit
  )
  union all
  (
    select 'customer', c.id, c.company_name, c.customer_code, '/customers/' || c.id,
           similarity(c.company_name, q.term)
    from public.customers c, q
    where c.company_name ilike '%' || p_query || '%'
       or c.customer_code ilike '%' || p_query || '%'
       or c.phone         ilike '%' || p_query || '%'
       or c.email::text   ilike '%' || p_query || '%'
    order by 6 desc
    limit p_limit
  )
  union all
  (
    select 'engineer', e.id, e.full_name, e.employee_code, '/engineers/' || e.id,
           similarity(e.full_name, q.term)
    from public.employees e, q
    where e.full_name     ilike '%' || p_query || '%'
       or e.employee_code ilike '%' || p_query || '%'
       or e.email::text   ilike '%' || p_query || '%'
       or e.phone         ilike '%' || p_query || '%'
    order by 6 desc
    limit p_limit
  )
  union all
  (
    select 'asset', a.id, a.asset_tag, a.name || coalesce(' - ' || a.serial_number, ''),
           '/assets/' || a.id, similarity(a.asset_tag, q.term)
    from public.assets a, q
    where a.asset_tag     ilike '%' || p_query || '%'
       or a.serial_number ilike '%' || p_query || '%'
       or a.name          ilike '%' || p_query || '%'
    order by 6 desc
    limit p_limit
  )
  union all
  (
    select 'amc', m.id, m.amc_number, c.company_name, '/amc/' || m.id,
           similarity(m.amc_number, q.term)
    from public.amc_contracts m
    join public.customers c on c.id = m.customer_id, q
    where m.amc_number ilike '%' || p_query || '%'
    order by 6 desc
    limit p_limit
  )
  union all
  (
    select 'service_report', s.id, s.report_number, c.company_name,
           '/reports/service/' || s.id, similarity(s.report_number, q.term)
    from public.service_reports s
    join public.customers c on c.id = s.customer_id, q
    where s.report_number ilike '%' || p_query || '%'
    order by 6 desc
    limit p_limit
  );
$$;

-- ---------------------------------------------------------------------
-- Dashboard aggregate. One round trip instead of a dozen.
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public, app, pg_temp
as $$
  with scoped as (
    select * from public.tickets t
    where (p_from is null or t.created_at >= p_from)
      and (p_to   is null or t.created_at <  p_to)
  )
  select jsonb_build_object(
    'total_tickets',      (select count(*) from scoped),
    'new_tickets',        (select count(*) from scoped where status = 'NEW'),
    'open_tickets',       (select count(*) from scoped where status not in ('RESOLVED','CLOSED','CANCELLED')),
    'in_progress',        (select count(*) from scoped where status in ('IN_PROGRESS','ON_SITE','ACCEPTED')),
    'on_hold',            (select count(*) from scoped where status in ('ON_HOLD','PENDING_CUSTOMER','PENDING_PARTS')),
    'resolved',           (select count(*) from scoped where status = 'RESOLVED'),
    'closed',             (select count(*) from scoped where status = 'CLOSED'),
    'cancelled',          (select count(*) from scoped where status = 'CANCELLED'),
    'reopened',           (select count(*) from scoped where reopen_count > 0),
    'overdue',            (select count(*) from scoped
                            where status not in ('RESOLVED','CLOSED','CANCELLED')
                              and resolution_due_at < now()),
    'sla_at_risk',        (select count(*) from scoped where resolution_state = 'at_risk'),
    'sla_breached',       (select count(*) from scoped where resolution_state = 'breached'),
    'sla_compliance',     (select round(100.0 * count(*) filter (where resolution_state = 'met')
                                  / nullif(count(*) filter (where resolution_state in ('met','breached')), 0), 1)
                           from scoped),
    'avg_resolution_hours', (select round(avg(extract(epoch from (resolved_at - created_at)) / 3600.0), 2)
                             from scoped where resolved_at is not null),
    'avg_response_minutes', (select round(avg(extract(epoch from (first_response_at - created_at)) / 60.0), 1)
                             from scoped where first_response_at is not null),
    'csat',               (select round(avg(f.overall_rating), 2)
                           from public.customer_feedback f
                           join scoped s on s.id = f.ticket_id),
    'by_status',          (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                           from (select status, count(*) n from scoped group by status) x),
    'by_priority',        (select coalesce(jsonb_agg(jsonb_build_object(
                              'code', p.code, 'name', p.name, 'colour', p.colour, 'count', x.n)
                              order by p.severity desc), '[]'::jsonb)
                           from (select priority_id, count(*) n from scoped group by priority_id) x
                           join public.priorities p on p.id = x.priority_id),
    'by_category',        (select coalesce(jsonb_agg(jsonb_build_object(
                              'name', c.name, 'colour', c.colour, 'count', x.n) order by x.n desc), '[]'::jsonb)
                           from (select category_id, count(*) n from scoped
                                 where category_id is not null group by category_id) x
                           join public.categories c on c.id = x.category_id),
    'monthly_trend',      (select coalesce(jsonb_agg(jsonb_build_object(
                              'month', to_char(m, 'YYYY-MM'),
                              'created', created_n,
                              'resolved', resolved_n) order by m), '[]'::jsonb)
                           from (
                             select date_trunc('month', created_at at time zone 'Asia/Dubai') as m,
                                    count(*) as created_n,
                                    count(*) filter (where resolved_at is not null) as resolved_n
                             from scoped group by 1
                           ) t)
  )
$$;

-- The views are created after 0013 ran its blanket grants, so they need
-- their own. They are security_invoker, so RLS on the base tables still
-- decides which rows each principal actually receives.
grant select on
  public.v_tickets_overview,
  public.v_engineer_performance,
  public.v_customer_summary,
  public.v_amc_expiring
to authenticated;

grant execute on function
  public.has_permission(text),
  public.my_permissions(),
  public.customer_reopen_ticket(uuid, text),
  public.customer_decide_work(uuid, boolean, text),
  public.engineer_accept_ticket(uuid),
  public.mark_notifications_read(uuid[]),
  public.unread_notification_count(),
  public.global_search(text, int),
  public.dashboard_stats(timestamptz, timestamptz)
to authenticated;

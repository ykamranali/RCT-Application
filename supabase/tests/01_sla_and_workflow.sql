-- =====================================================================
-- RCT APPLICATION | Test suite 1 - SLA engine and ticket workflow
--
-- Run against a database that has all migrations applied:
--   psql "$DATABASE_URL" -f supabase/tests/01_sla_and_workflow.sql
--
-- Exits non-zero on the first failure when psql is invoked with
-- -v ON_ERROR_STOP=1.
-- =====================================================================

\set ON_ERROR_STOP on
\timing off

-- The suite writes tickets in order to exercise the triggers. Everything
-- runs inside a transaction that is rolled back at the end, so running the
-- tests never leaves residue in the database.
begin;

create temporary table _results (
  id     serial primary key,
  name   text,
  passed boolean,
  detail text
);

create or replace function pg_temp.check_eq(p_name text, p_actual anyelement, p_expected anyelement)
returns void language plpgsql as $$
begin
  insert into _results (name, passed, detail)
  values (p_name,
          p_actual is not distinct from p_expected,
          format('expected=%s actual=%s', p_expected, p_actual));
end $$;

create or replace function pg_temp.check_true(p_name text, p_actual boolean, p_detail text default null)
returns void language plpgsql as $$
begin
  insert into _results (name, passed, detail) values (p_name, coalesce(p_actual, false), p_detail);
end $$;

-- Records that an operation raised, which is the desired behaviour.
create or replace function pg_temp.check_raises(p_name text, p_sql text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    insert into _results (name, passed, detail) values (p_name, false, 'no exception was raised');
  exception when others then
    insert into _results (name, passed, detail) values (p_name, true, 'raised: ' || sqlerrm);
  end;
end $$;

-- =====================================================================
-- 1. Business-hours arithmetic
-- =====================================================================
do $$
declare
  v_std uuid;
  v_247 uuid;
  v_start timestamptz;
  v_got   timestamptz;
begin
  select id into v_std from public.sla_plans where code = 'STANDARD';
  select id into v_247 from public.sla_plans where code = 'CRITICAL_24X7';

  -- --- 24x7 plan: the clock never stops -------------------------------
  v_start := timestamptz '2026-08-13 22:00:00+04';   -- Thursday 22:00 Dubai
  perform pg_temp.check_eq(
    '24x7 plan adds elapsed time directly (240 min)',
    app.add_working_minutes(v_start, 240, v_247),
    timestamptz '2026-08-14 02:00:00+04');

  -- --- Standard plan: Sun-Thu 08:00-18:00 -----------------------------
  -- Thursday 13 Aug 2026 17:00 + 120 working minutes.
  -- 60 minutes are consumed before the 18:00 close; Friday and Saturday
  -- are non-working; the remaining 60 minutes run from Sunday 08:00.
  perform pg_temp.check_eq(
    'Standard plan skips the UAE weekend',
    app.add_working_minutes(timestamptz '2026-08-13 17:00:00+04', 120, v_std),
    timestamptz '2026-08-16 09:00:00+04');

  -- Wholly inside one working day.
  perform pg_temp.check_eq(
    'Standard plan inside a single working day',
    app.add_working_minutes(timestamptz '2026-08-12 09:00:00+04', 240, v_std),
    timestamptz '2026-08-12 13:00:00+04');

  -- Starting before opening time rolls forward to the open.
  perform pg_temp.check_eq(
    'Start before opening rolls forward to 08:00',
    app.add_working_minutes(timestamptz '2026-08-12 05:00:00+04', 60, v_std),
    timestamptz '2026-08-12 09:00:00+04');

  -- Spanning two working days: Wed 17:00 + 180 -> 60 today, 120 Thursday.
  perform pg_temp.check_eq(
    'Standard plan spans consecutive working days',
    app.add_working_minutes(timestamptz '2026-08-12 17:00:00+04', 180, v_std),
    timestamptz '2026-08-13 10:00:00+04');

  -- --- Holidays --------------------------------------------------------
  -- 2 Dec 2026 (Wednesday) is UAE National Day and is seeded as a holiday,
  -- as are 1 and 3 Dec. Starting Monday 30 Nov 17:00 + 120 minutes:
  -- 60 minutes on the 30th, then 1/2/3 Dec are skipped, so the remaining
  -- 60 minutes run from Friday... which is non-working, as is Saturday.
  -- The deadline therefore lands on Sunday 6 Dec at 09:00.
  perform pg_temp.check_eq(
    'Holidays are skipped by the SLA clock',
    app.add_working_minutes(timestamptz '2026-11-30 17:00:00+04', 120, v_std),
    timestamptz '2026-12-06 09:00:00+04');

  perform pg_temp.check_true(
    'UAE National Day is not a working day',
    not app.is_working_day(v_std, date '2026-12-02'));

  perform pg_temp.check_true(
    'Friday is not a working day on the Standard plan',
    not app.is_working_day(v_std, date '2026-08-14'));

  perform pg_temp.check_true(
    'Sunday is a working day on the Standard plan',
    app.is_working_day(v_std, date '2026-08-16'));

  -- --- Elapsed working minutes ----------------------------------------
  perform pg_temp.check_eq(
    'working_minutes_between counts only open hours',
    app.working_minutes_between(
      timestamptz '2026-08-12 16:00:00+04',
      timestamptz '2026-08-13 10:00:00+04', v_std)::int,
    240);   -- 2h on Wednesday + 2h on Thursday

  perform pg_temp.check_eq(
    'working_minutes_between ignores the weekend',
    app.working_minutes_between(
      timestamptz '2026-08-13 17:00:00+04',
      timestamptz '2026-08-16 09:00:00+04', v_std)::int,
    120);
end $$;

-- =====================================================================
-- 2. SLA state classification
-- =====================================================================
do $$
declare
  v_start timestamptz := timestamptz '2026-08-15 08:00:00+04';
  v_due   timestamptz := timestamptz '2026-08-15 12:00:00+04';   -- 4h target
begin
  perform pg_temp.check_eq('SLA met when achieved before the deadline',
    app.compute_sla_state(v_start, v_due, timestamptz '2026-08-15 11:00:00+04', 80,
                          timestamptz '2026-08-15 11:00:00+04'),
    'met'::app.sla_state);

  perform pg_temp.check_eq('SLA breached when achieved after the deadline',
    app.compute_sla_state(v_start, v_due, timestamptz '2026-08-15 13:00:00+04', 80,
                          timestamptz '2026-08-15 13:00:00+04'),
    'breached'::app.sla_state);

  -- 50% consumed, still open -> on track
  perform pg_temp.check_eq('SLA on track at 50% consumed',
    app.compute_sla_state(v_start, v_due, null, 80, timestamptz '2026-08-15 10:00:00+04'),
    'met'::app.sla_state);

  -- 87.5% consumed, still open -> at risk (threshold 80)
  perform pg_temp.check_eq('SLA at risk once the threshold is crossed',
    app.compute_sla_state(v_start, v_due, null, 80, timestamptz '2026-08-15 11:30:00+04'),
    'at_risk'::app.sla_state);

  -- Past due, still open -> breached
  perform pg_temp.check_eq('SLA breached once the deadline passes with no resolution',
    app.compute_sla_state(v_start, v_due, null, 80, timestamptz '2026-08-15 12:30:00+04'),
    'breached'::app.sla_state);

  perform pg_temp.check_eq('No target means not applicable',
    app.compute_sla_state(v_start, null, null, 80, now()),
    'not_applicable'::app.sla_state);
end $$;

-- =====================================================================
-- 3. Ticket numbering
-- =====================================================================
do $$
declare
  v_cust uuid; v_prio uuid; v_cat uuid;
  a text; b text; c text;
  v_year text := to_char(now() at time zone 'Asia/Dubai', 'YYYY');
begin
  select id into v_cust from public.customers limit 1;
  select id into v_prio from public.priorities where code = 'MEDIUM';
  select id into v_cat  from public.categories where code = 'NETWORK';

  insert into public.tickets (customer_id, category_id, priority_id, subject, description)
  values (v_cust, v_cat, v_prio, 'Numbering test A', 'Verifying document number allocation.')
  returning ticket_number into a;

  insert into public.tickets (customer_id, category_id, priority_id, subject, description)
  values (v_cust, v_cat, v_prio, 'Numbering test B', 'Verifying document number allocation.')
  returning ticket_number into b;

  perform pg_temp.check_true('Ticket numbers use the TKT-YYYY-NNNNNN format',
    a ~ ('^TKT-' || v_year || '-[0-9]{6}$'), a);

  perform pg_temp.check_true('Ticket numbers are allocated sequentially',
    (split_part(b, '-', 3))::int = (split_part(a, '-', 3))::int + 1,
    a || ' -> ' || b);

  -- The number is immutable.
  perform pg_temp.check_raises('Ticket number cannot be rewritten',
    format('update public.tickets set ticket_number = %L where ticket_number = %L',
           'TKT-1999-000001', b));

  delete from public.tickets where ticket_number in (a, b);
end $$;

-- =====================================================================
-- 4. SLA targets are stamped on creation
-- =====================================================================
do $$
declare
  v_cust uuid; v_ticket public.tickets;
  v_plan uuid;
  v_original_plan uuid;
begin
  -- Use a customer on the 24x7 plan so the arithmetic is unambiguous.
  select id into v_plan from public.sla_plans where code = 'CRITICAL_24X7';
  select id into v_cust from public.customers order by customer_code limit 1;
  select sla_plan_id into v_original_plan from public.customers where id = v_cust;
  update public.customers set sla_plan_id = v_plan where id = v_cust;

  insert into public.tickets (customer_id, priority_id, subject, description)
  select v_cust, p.id, 'SLA stamping test', 'Verifying that SLA deadlines are computed on insert.'
  from public.priorities p where p.code = 'CRITICAL'
  returning * into v_ticket;

  -- Critical on the 24x7 plan: response 15 min, resolution 120 min.
  perform pg_temp.check_eq('Response deadline stamped from the SLA rule',
    v_ticket.response_due_at, v_ticket.created_at + interval '15 minutes');

  perform pg_temp.check_eq('Resolution deadline stamped from the SLA rule',
    v_ticket.resolution_due_at, v_ticket.created_at + interval '120 minutes');

  perform pg_temp.check_eq('A new ticket starts on track',
    v_ticket.resolution_state, 'met'::app.sla_state);

  delete from public.tickets where id = v_ticket.id;
  update public.customers set sla_plan_id = v_original_plan where id = v_cust;
end $$;

-- =====================================================================
-- 5. State machine
-- =====================================================================
do $$
declare
  v_cust uuid; v_eng uuid; v_id uuid; v_status app.ticket_status;
  v_due_before timestamptz; v_due_after timestamptz;
begin
  -- Pin to a plan with pause_on_hold enabled so the pause assertions are
  -- meaningful regardless of which plan each seeded customer happens to use.
  select c.id into v_cust
  from public.customers c
  join public.sla_plans s on s.id = c.sla_plan_id
  where s.pause_on_hold
  limit 1;
  select id into v_eng from public.employees where role = 'engineer' limit 1;

  insert into public.tickets (customer_id, priority_id, subject, description)
  select v_cust, p.id, 'Workflow test', 'Verifying the ticket state machine end to end.'
  from public.priorities p where p.code = 'HIGH'
  returning id into v_id;

  -- NEW -> RESOLVED is not a legal jump.
  perform pg_temp.check_raises('Illegal transition NEW -> RESOLVED is rejected',
    format('update public.tickets set status = ''RESOLVED'' where id = %L', v_id));

  -- Assigning an engineer moves the ticket to ASSIGNED automatically.
  update public.tickets set assigned_engineer_id = v_eng where id = v_id;
  select status into v_status from public.tickets where id = v_id;
  perform pg_temp.check_eq('Assigning an engineer moves NEW -> ASSIGNED', v_status, 'ASSIGNED'::app.ticket_status);

  update public.tickets set status = 'ACCEPTED' where id = v_id;

  perform pg_temp.check_true('Accepting the ticket records the first response',
    (select first_response_at is not null from public.tickets where id = v_id));

  update public.tickets set status = 'IN_PROGRESS' where id = v_id;

  -- Resolving without a diagnosis must fail.
  perform pg_temp.check_raises('Cannot resolve without a diagnosis',
    format($f$update public.tickets
              set status = 'RESOLVED', resolution_summary = 'All good now, fixed.'
            where id = %L$f$, v_id));

  -- Resolving without work performed must fail.
  perform pg_temp.check_raises('Cannot resolve without work performed',
    format($f$update public.tickets
              set status = 'RESOLVED', diagnosis = 'Faulty patch lead.',
                  resolution_summary = 'All good now, fixed.'
            where id = %L$f$, v_id));

  -- Resolving without a resolution summary must fail (CHECK constraint).
  perform pg_temp.check_raises('Cannot resolve without a resolution summary',
    format($f$update public.tickets
              set status = 'RESOLVED', diagnosis = 'Faulty patch lead.',
                  work_performed = 'Replaced the patch lead and retested.'
            where id = %L$f$, v_id));

  -- --- SLA pause accounting -------------------------------------------
  select resolution_due_at into v_due_before from public.tickets where id = v_id;

  update public.tickets set status = 'ON_HOLD' where id = v_id;
  perform pg_temp.check_true('Going on hold pauses the SLA clock',
    (select paused_since is not null from public.tickets where id = v_id));

  perform pg_sleep(1.2);

  update public.tickets set status = 'IN_PROGRESS' where id = v_id;
  select resolution_due_at into v_due_after from public.tickets where id = v_id;

  perform pg_temp.check_true('Resuming clears the pause marker',
    (select paused_since is null and paused_ms > 0 from public.tickets where id = v_id));

  perform pg_temp.check_true('Paused time is added back to the resolution deadline',
    v_due_after > v_due_before,
    format('%s -> %s', v_due_before, v_due_after));

  -- Now resolve properly.
  update public.tickets
     set status = 'RESOLVED',
         diagnosis = 'Faulty patch lead between the wall port and the switch.',
         work_performed = 'Replaced the patch lead, re-terminated the wall port and retested throughput.',
         resolution_summary = 'Connectivity restored and verified with the site contact.'
   where id = v_id;

  select status into v_status from public.tickets where id = v_id;
  perform pg_temp.check_eq('Ticket resolves once every mandatory field is present',
    v_status, 'RESOLVED'::app.ticket_status);

  perform pg_temp.check_true('Resolving stamps resolved_at',
    (select resolved_at is not null from public.tickets where id = v_id));

  update public.tickets set status = 'CLOSED' where id = v_id;
  perform pg_temp.check_true('Closing stamps closed_at',
    (select closed_at is not null from public.tickets where id = v_id));

  -- Reopening restarts the resolution clock and increments the counter.
  update public.tickets set status = 'REOPENED' where id = v_id;
  perform pg_temp.check_true('Reopening increments reopen_count and clears resolution',
    (select reopen_count = 1 and resolved_at is null and closed_at is null
     from public.tickets where id = v_id));

  -- Timeline should contain every one of those transitions.
  perform pg_temp.check_true('Every transition is written to the timeline',
    (select count(*) >= 8 from public.ticket_status_history where ticket_id = v_id),
    (select count(*)::text || ' events' from public.ticket_status_history where ticket_id = v_id));

  delete from public.tickets where id = v_id;
end $$;

-- =====================================================================
-- 6. Data integrity guards
-- =====================================================================
do $$
declare
  v_cust uuid; v_other_branch uuid; v_prio uuid;
begin
  select id into v_cust from public.customers order by customer_code limit 1;
  select b.id into v_other_branch
  from public.branches b where b.customer_id <> v_cust limit 1;
  select id into v_prio from public.priorities where code = 'LOW';

  perform pg_temp.check_raises('A ticket cannot reference another customer''s branch',
    format($f$insert into public.tickets (customer_id, branch_id, priority_id, subject, description)
              values (%L, %L, %L, 'Cross tenant branch', 'This insert must be rejected by the trigger.')$f$,
           v_cust, v_other_branch, v_prio));

  perform pg_temp.check_raises('Subject must be at least 3 characters',
    format($f$insert into public.tickets (customer_id, priority_id, subject, description)
              values (%L, %L, 'ab', 'A description that is long enough to pass.')$f$, v_cust, v_prio));

  perform pg_temp.check_raises('Description must be at least 10 characters',
    format($f$insert into public.tickets (customer_id, priority_id, subject, description)
              values (%L, %L, 'Valid subject', 'short')$f$, v_cust, v_prio));

  perform pg_temp.check_raises('Part quantity must be positive',
    format($f$insert into public.ticket_parts (ticket_id, part_name, quantity)
              values ((select id from public.tickets limit 1), 'Bad part', 0)$f$));

  perform pg_temp.check_raises('Feedback rating must be between 1 and 5',
    format($f$insert into public.customer_feedback (ticket_id, customer_id, overall_rating)
              values ((select id from public.tickets limit 1), %L, 9)$f$, v_cust));
end $$;

-- =====================================================================
-- 7. Allowed-transition helper drives the UI
-- =====================================================================
do $$
begin
  perform pg_temp.check_true('RESOLVED may move to CLOSED',
    'CLOSED' = any (app.allowed_transitions('RESOLVED')));
  perform pg_temp.check_true('CLOSED may only be reopened',
    app.allowed_transitions('CLOSED') = array['REOPENED']::app.ticket_status[]);
  perform pg_temp.check_true('NEW may not jump straight to RESOLVED',
    not ('RESOLVED' = any (app.allowed_transitions('NEW'))));
end $$;

-- =====================================================================
-- Report
-- =====================================================================
\echo ''
\echo '================ SLA & WORKFLOW TEST RESULTS ================'
select
  case when passed then '  PASS' else '  FAIL' end as result,
  name,
  case when passed then '' else detail end as detail
from _results order by id;

select count(*) filter (where passed)     as passed,
       count(*) filter (where not passed) as failed,
       count(*)                           as total
from _results;

do $$
declare v_failed int;
begin
  select count(*) into v_failed from _results where not passed;
  if v_failed > 0 then
    raise exception '% SLA/workflow test(s) failed', v_failed;
  end if;
  raise notice 'All SLA and workflow tests passed.';
end $$;

rollback;

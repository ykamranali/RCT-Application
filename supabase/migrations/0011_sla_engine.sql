-- =====================================================================
-- RCT APPLICATION | Migration 0011 - SLA engine
--
-- All arithmetic is performed in the SLA plan's timezone (Asia/Dubai by
-- default) so that "8 business hours" means what the customer thinks it
-- means, regardless of where the server happens to run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Is a given local date a working day for this plan?
-- ---------------------------------------------------------------------
create or replace function app.is_working_day(p_plan_id uuid, p_date date)
returns boolean
language plpgsql
stable
as $$
declare
  v_dow int := extract(isodow from p_date);
  v_working boolean;
begin
  -- Holidays win over business hours.
  if exists (
    select 1 from public.holidays h
    where (h.sla_plan_id = p_plan_id or h.sla_plan_id is null)
      and (
        h.holiday_date = p_date
        or (h.is_recurring
            and extract(month from h.holiday_date) = extract(month from p_date)
            and extract(day   from h.holiday_date) = extract(day   from p_date))
      )
  ) then
    return false;
  end if;

  select bh.is_working_day into v_working
  from public.business_hours bh
  where bh.sla_plan_id = p_plan_id
    and bh.day_of_week = v_dow
  limit 1;

  -- No calendar configured for this plan == treat every day as working.
  return coalesce(v_working, true);
end;
$$;

-- ---------------------------------------------------------------------
-- Add N working minutes to a timestamp, honouring the plan's calendar.
--
-- For a 24x7 plan (or a plan with no calendar rows) this degenerates to
-- simple interval arithmetic, which is the fast path.
-- ---------------------------------------------------------------------
create or replace function app.add_working_minutes(
  p_start   timestamptz,
  p_minutes int,
  p_plan_id uuid
)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_tz        text := 'Asia/Dubai';
  v_24x7      boolean := true;
  v_remaining numeric := p_minutes;
  v_local     timestamp;          -- wall-clock in plan timezone
  v_date      date;
  v_dow       int;
  v_opens     time;
  v_closes    time;
  v_win_start timestamp;
  v_win_end   timestamp;
  v_avail     numeric;
  v_guard     int := 0;
begin
  if p_minutes is null or p_minutes <= 0 then
    return p_start;
  end if;

  if p_plan_id is not null then
    select s.timezone, s.is_24x7 into v_tz, v_24x7
    from public.sla_plans s where s.id = p_plan_id;
    v_tz   := coalesce(v_tz, 'Asia/Dubai');
    v_24x7 := coalesce(v_24x7, true);
  end if;

  -- Fast path: continuous clock.
  if v_24x7 or not exists (
       select 1 from public.business_hours bh where bh.sla_plan_id = p_plan_id
     ) then
    return p_start + make_interval(mins => p_minutes);
  end if;

  v_local := p_start at time zone v_tz;

  -- Walk forward day by day, consuming the open window of each working day.
  while v_remaining > 0 loop
    v_guard := v_guard + 1;
    if v_guard > 750 then
      -- Pathological calendar (e.g. zero working days). Fail safe rather
      -- than spin: fall back to a continuous clock for the remainder.
      return (v_local at time zone v_tz) + make_interval(mins => ceil(v_remaining)::int);
    end if;

    v_date := v_local::date;
    v_dow  := extract(isodow from v_date);

    if app.is_working_day(p_plan_id, v_date) then
      select bh.opens_at, bh.closes_at into v_opens, v_closes
      from public.business_hours bh
      where bh.sla_plan_id = p_plan_id and bh.day_of_week = v_dow
      limit 1;

      if v_opens is not null then
        v_win_start := v_date + v_opens;
        v_win_end   := v_date + v_closes;

        -- Never rewind: if we are mid-window, start from where we are.
        if v_local > v_win_start then
          v_win_start := v_local;
        end if;

        if v_win_start < v_win_end then
          v_avail := extract(epoch from (v_win_end - v_win_start)) / 60.0;

          if v_avail >= v_remaining then
            return (v_win_start + make_interval(mins => v_remaining::int)
                                + make_interval(secs => ((v_remaining - floor(v_remaining)) * 60)::int))
                   at time zone v_tz;
          end if;

          v_remaining := v_remaining - v_avail;
        end if;
      end if;
    end if;

    -- Move to 00:00 of the next local day.
    v_local := (v_date + 1)::timestamp;
  end loop;

  return v_local at time zone v_tz;
end;
$$;

comment on function app.add_working_minutes is
  'Returns the deadline reached by consuming p_minutes of the SLA plan''s working calendar starting at p_start. Holidays and non-working days are skipped.';

-- ---------------------------------------------------------------------
-- Working minutes actually elapsed between two instants.
-- ---------------------------------------------------------------------
create or replace function app.working_minutes_between(
  p_start   timestamptz,
  p_end     timestamptz,
  p_plan_id uuid
)
returns numeric
language plpgsql
stable
as $$
declare
  v_tz      text := 'Asia/Dubai';
  v_24x7    boolean := true;
  v_total   numeric := 0;
  v_local   timestamp;
  v_end_loc timestamp;
  v_date    date;
  v_dow     int;
  v_opens   time;
  v_closes  time;
  v_ws      timestamp;
  v_we      timestamp;
  v_guard   int := 0;
begin
  if p_start is null or p_end is null or p_end <= p_start then
    return 0;
  end if;

  if p_plan_id is not null then
    select s.timezone, s.is_24x7 into v_tz, v_24x7
    from public.sla_plans s where s.id = p_plan_id;
    v_tz   := coalesce(v_tz, 'Asia/Dubai');
    v_24x7 := coalesce(v_24x7, true);
  end if;

  if v_24x7 or not exists (
       select 1 from public.business_hours bh where bh.sla_plan_id = p_plan_id
     ) then
    return extract(epoch from (p_end - p_start)) / 60.0;
  end if;

  v_local   := p_start at time zone v_tz;
  v_end_loc := p_end   at time zone v_tz;

  while v_local < v_end_loc loop
    v_guard := v_guard + 1;
    exit when v_guard > 750;

    v_date := v_local::date;
    v_dow  := extract(isodow from v_date);

    if app.is_working_day(p_plan_id, v_date) then
      select bh.opens_at, bh.closes_at into v_opens, v_closes
      from public.business_hours bh
      where bh.sla_plan_id = p_plan_id and bh.day_of_week = v_dow
      limit 1;

      if v_opens is not null then
        v_ws := greatest(v_date + v_opens,  v_local);
        v_we := least   (v_date + v_closes, v_end_loc);
        if v_we > v_ws then
          v_total := v_total + extract(epoch from (v_we - v_ws)) / 60.0;
        end if;
      end if;
    end if;

    v_local := (v_date + 1)::timestamp;
  end loop;

  return v_total;
end;
$$;

-- ---------------------------------------------------------------------
-- Resolve the SLA rule that applies to a ticket.
-- Customer plan -> platform default plan.
-- ---------------------------------------------------------------------
create or replace function app.resolve_sla_plan(p_customer_id uuid)
returns uuid
language sql
stable
as $$
  select coalesce(
    (select c.sla_plan_id from public.customers c where c.id = p_customer_id),
    (select s.id from public.sla_plans s where s.is_default and s.is_active limit 1)
  )
$$;

-- ---------------------------------------------------------------------
-- Classify an SLA dimension into met / at_risk / breached.
-- ---------------------------------------------------------------------
create or replace function app.compute_sla_state(
  p_start     timestamptz,
  p_due       timestamptz,
  p_actual    timestamptz,
  p_threshold int default 80,
  p_now       timestamptz default now()
)
returns app.sla_state
language plpgsql
immutable
as $$
declare
  v_total   numeric;
  v_used    numeric;
begin
  if p_due is null then
    return 'not_applicable';
  end if;

  -- Already achieved: the only question is whether it landed in time.
  if p_actual is not null then
    return case when p_actual <= p_due then 'met' else 'breached' end;
  end if;

  if p_now > p_due then
    return 'breached';
  end if;

  if p_start is null then
    return 'met';
  end if;

  v_total := extract(epoch from (p_due   - p_start));
  v_used  := extract(epoch from (p_now   - p_start));

  if v_total <= 0 then
    return 'breached';
  end if;

  if (v_used / v_total) * 100 >= p_threshold then
    return 'at_risk';
  end if;

  return 'met';
end;
$$;

-- ---------------------------------------------------------------------
-- Rich SLA snapshot for a single ticket, used by the API and dashboards.
-- ---------------------------------------------------------------------
create or replace function app.ticket_sla(p_ticket_id uuid)
returns table (
  ticket_id            uuid,
  response_due_at      timestamptz,
  resolution_due_at    timestamptz,
  response_state       app.sla_state,
  resolution_state     app.sla_state,
  response_remaining_minutes   numeric,
  resolution_remaining_minutes numeric,
  response_used_percent        numeric,
  resolution_used_percent      numeric,
  is_paused            boolean
)
language sql
stable
as $$
  with t as (
    select tk.*, coalesce(sp.at_risk_threshold, 80) as threshold
    from public.tickets tk
    left join public.sla_plans sp on sp.id = tk.sla_plan_id
    where tk.id = p_ticket_id
  )
  select
    t.id,
    t.response_due_at,
    t.resolution_due_at,
    app.compute_sla_state(t.created_at, t.response_due_at,   t.first_response_at, t.threshold),
    app.compute_sla_state(t.created_at, t.resolution_due_at, t.resolved_at,       t.threshold),
    case when t.first_response_at is not null or t.response_due_at is null then null
         else round(extract(epoch from (t.response_due_at - now())) / 60.0, 1) end,
    case when t.resolved_at is not null or t.resolution_due_at is null then null
         else round(extract(epoch from (t.resolution_due_at - now())) / 60.0, 1) end,
    case when t.response_due_at is null then null
         else round(least(100, greatest(0,
              extract(epoch from (coalesce(t.first_response_at, now()) - t.created_at))
            / nullif(extract(epoch from (t.response_due_at - t.created_at)), 0) * 100)), 1) end,
    case when t.resolution_due_at is null then null
         else round(least(100, greatest(0,
              extract(epoch from (coalesce(t.resolved_at, now()) - t.created_at))
            / nullif(extract(epoch from (t.resolution_due_at - t.created_at)), 0) * 100)), 1) end,
    t.paused_since is not null
  from t;
$$;

-- ---------------------------------------------------------------------
-- Sweep job: re-classify open tickets and raise warning / breach events.
-- Invoked by a scheduled task (pg_cron or the /api/cron/sla route).
-- ---------------------------------------------------------------------
create or replace function app.sweep_sla()
returns table (updated int, warned int, breached int)
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_updated  int := 0;
  v_warned   int := 0;
  v_breached int := 0;
  r record;
  v_new_resp app.sla_state;
  v_new_res  app.sla_state;
begin
  for r in
    select t.id, t.ticket_number, t.created_at, t.response_due_at, t.resolution_due_at,
           t.first_response_at, t.resolved_at, t.response_state, t.resolution_state,
           coalesce(sp.at_risk_threshold, 80) as threshold
    from public.tickets t
    left join public.sla_plans sp on sp.id = t.sla_plan_id
    where t.status not in ('CLOSED', 'CANCELLED')
      and t.paused_since is null
  loop
    v_new_resp := app.compute_sla_state(r.created_at, r.response_due_at,   r.first_response_at, r.threshold);
    v_new_res  := app.compute_sla_state(r.created_at, r.resolution_due_at, r.resolved_at,       r.threshold);

    if v_new_resp is distinct from r.response_state
       or v_new_res is distinct from r.resolution_state then

      update public.tickets
         set response_state   = v_new_resp,
             resolution_state = v_new_res
       where id = r.id;
      v_updated := v_updated + 1;

      if v_new_res = 'at_risk' and r.resolution_state <> 'at_risk' then
        v_warned := v_warned + 1;
        perform app.notify_profiles(
          app.ticket_watchers(r.id),
          'sla.warning',
          'SLA at risk: ' || r.ticket_number,
          'This ticket is approaching its resolution deadline.',
          'warning', r.id, '/tickets/' || r.id
        );
        insert into public.ticket_status_history
          (ticket_id, to_status, event_type, note, changed_by_name)
        select r.id, t.status, 'sla_warning', 'Resolution SLA at risk', 'System'
        from public.tickets t where t.id = r.id;
      end if;

      if v_new_res = 'breached' and r.resolution_state <> 'breached' then
        v_breached := v_breached + 1;
        perform app.notify_profiles(
          app.ticket_watchers(r.id),
          'sla.breached',
          'SLA breached: ' || r.ticket_number,
          'The resolution deadline for this ticket has passed.',
          'critical', r.id, '/tickets/' || r.id
        );
        insert into public.ticket_status_history
          (ticket_id, to_status, event_type, note, changed_by_name)
        select r.id, t.status, 'sla_breach', 'Resolution SLA breached', 'System'
        from public.tickets t where t.id = r.id;
      end if;
    end if;
  end loop;

  return query select v_updated, v_warned, v_breached;
end;
$$;

-- =====================================================================
-- RCT APPLICATION | Migration 0012 - Ticket workflow, state machine,
--                    timeline and notification fan-out
-- =====================================================================

-- ---------------------------------------------------------------------
-- Which statuses may follow a given status. Exposed to the UI so the
-- action panel only ever renders legal transitions.
-- ---------------------------------------------------------------------
create or replace function app.allowed_transitions(p_from app.ticket_status)
returns app.ticket_status[]
language sql
immutable
as $$
  select case p_from
    when 'NEW'              then array['ASSIGNED','ACCEPTED','ON_HOLD','CANCELLED']
    when 'ASSIGNED'         then array['ACCEPTED','ASSIGNED','IN_PROGRESS','ON_HOLD','CANCELLED']
    when 'ACCEPTED'         then array['IN_PROGRESS','ON_SITE','ON_HOLD','PENDING_CUSTOMER','PENDING_PARTS','ASSIGNED','CANCELLED']
    when 'IN_PROGRESS'      then array['ON_SITE','ON_HOLD','PENDING_CUSTOMER','PENDING_PARTS','RESOLVED','ASSIGNED','CANCELLED']
    when 'ON_SITE'          then array['IN_PROGRESS','ON_HOLD','PENDING_CUSTOMER','PENDING_PARTS','RESOLVED','CANCELLED']
    when 'ON_HOLD'          then array['ACCEPTED','IN_PROGRESS','ON_SITE','PENDING_CUSTOMER','PENDING_PARTS','RESOLVED','CANCELLED']
    when 'PENDING_CUSTOMER' then array['IN_PROGRESS','ON_SITE','ON_HOLD','RESOLVED','CANCELLED']
    when 'PENDING_PARTS'    then array['IN_PROGRESS','ON_SITE','ON_HOLD','RESOLVED','CANCELLED']
    when 'RESOLVED'         then array['CLOSED','REOPENED','IN_PROGRESS']
    when 'CLOSED'           then array['REOPENED']
    when 'REOPENED'         then array['ASSIGNED','ACCEPTED','IN_PROGRESS','ON_SITE','ON_HOLD','CANCELLED']
    when 'CANCELLED'        then array['REOPENED']
    else array[]::text[]
  end::app.ticket_status[]
$$;

-- Statuses during which the SLA clock stops (when the plan allows it).
create or replace function app.is_paused_status(p_status app.ticket_status)
returns boolean
language sql
immutable
as $$
  select p_status in ('ON_HOLD', 'PENDING_CUSTOMER', 'PENDING_PARTS')
$$;

create or replace function app.setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select coalesce(
    (select (s.value #>> '{}')::boolean from public.system_settings s where s.key = p_key),
    p_default
  )
$$;

create or replace function app.setting_text(p_key text, p_default text)
returns text
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select coalesce(
    (select s.value #>> '{}' from public.system_settings s where s.key = p_key),
    p_default
  )
$$;

-- =====================================================================
-- BEFORE INSERT - numbering, defaults, SLA targets
-- =====================================================================
create or replace function app.ticket_before_insert()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_rule   record;
  v_prefix text;
  v_width  int;
begin
  if new.ticket_number is null or btrim(new.ticket_number) = '' then
    v_prefix := app.setting_text('ticket_prefix', 'TKT');
    v_width  := coalesce(nullif(app.setting_text('ticket_number_width', '6'), '')::int, 6);
    new.ticket_number := app.next_document_number('ticket', v_prefix, to_char(now() at time zone 'Asia/Dubai', 'YYYY'), v_width);
  end if;

  if new.priority_id is null then
    select p.id into new.priority_id from public.priorities p where p.is_default limit 1;
  end if;

  if new.branch_id is not null and new.customer_id is not null then
    if not exists (select 1 from public.branches b
                    where b.id = new.branch_id and b.customer_id = new.customer_id) then
      raise exception 'Branch does not belong to the selected customer'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Resolve the SLA plan and stamp the deadlines.
  new.sla_plan_id := coalesce(new.sla_plan_id, app.resolve_sla_plan(new.customer_id));

  select r.response_minutes, r.resolution_minutes
    into v_rule
  from public.sla_rules r
  where r.sla_plan_id = new.sla_plan_id
    and r.priority_id = new.priority_id;

  if found then
    new.response_due_at   := app.add_working_minutes(new.created_at, v_rule.response_minutes,   new.sla_plan_id);
    new.resolution_due_at := app.add_working_minutes(new.created_at, v_rule.resolution_minutes, new.sla_plan_id);
    new.response_state    := 'met';
    new.resolution_state  := 'met';
  else
    new.response_state   := 'not_applicable';
    new.resolution_state := 'not_applicable';
  end if;

  if new.assigned_engineer_id is not null and new.status = 'NEW' then
    new.status      := 'ASSIGNED';
    new.assigned_at := coalesce(new.assigned_at, now());
  end if;

  new.search_text := lower(concat_ws(' ',
    new.ticket_number, new.subject, new.description,
    new.contact_person, new.contact_phone, new.contact_email));

  return new;
end;
$$;

-- =====================================================================
-- BEFORE UPDATE - state machine, lifecycle stamps, SLA pause accounting
-- =====================================================================
create or replace function app.ticket_before_update()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_pause_allowed boolean := true;
  v_paused_ms     bigint;
  v_require_sig   boolean;
  v_threshold     int;
begin
  -- The ticket number is immutable once allocated.
  if new.ticket_number is distinct from old.ticket_number then
    raise exception 'Ticket number cannot be changed' using errcode = 'check_violation';
  end if;

  -- ---- state machine -------------------------------------------------
  if new.status is distinct from old.status then
    if not (new.status = any (app.allowed_transitions(old.status))) then
      raise exception 'Illegal ticket transition: % -> %', old.status, new.status
        using errcode = 'check_violation',
              hint = 'Allowed next statuses: ' || array_to_string(app.allowed_transitions(old.status), ', ');
    end if;

    -- Mandatory fields before a ticket may be resolved.
    if new.status = 'RESOLVED' then
      if new.diagnosis is null or length(btrim(new.diagnosis)) < 5 then
        raise exception 'Diagnosis is required before a ticket can be resolved'
          using errcode = 'check_violation';
      end if;
      if new.work_performed is null or length(btrim(new.work_performed)) < 5 then
        raise exception 'Work performed is required before a ticket can be resolved'
          using errcode = 'check_violation';
      end if;
      if new.assigned_engineer_id is null then
        raise exception 'A ticket cannot be resolved without an assigned engineer'
          using errcode = 'check_violation';
      end if;
    end if;

    -- Optional signature gate before closure.
    if new.status = 'CLOSED' then
      v_require_sig := app.setting_bool('require_signature_on_close', false);
      if v_require_sig and not exists (
        select 1 from public.customer_signatures s
        where s.ticket_id = new.id and s.signer_type = 'customer'
      ) then
        raise exception 'A customer signature is required before this ticket can be closed'
          using errcode = 'check_violation';
      end if;
    end if;

    -- ---- lifecycle stamps ---------------------------------------------
    case new.status
      when 'ASSIGNED'    then new.assigned_at      := coalesce(new.assigned_at, now());
      when 'ACCEPTED'    then new.accepted_at      := coalesce(new.accepted_at, now());
      when 'IN_PROGRESS' then new.work_started_at  := coalesce(new.work_started_at, now());
      when 'ON_SITE'     then new.on_site_at       := coalesce(new.on_site_at, now());
      when 'RESOLVED'    then new.resolved_at      := coalesce(new.resolved_at, now());
      when 'CLOSED'      then new.closed_at        := coalesce(new.closed_at, now());
      when 'CANCELLED'   then new.cancelled_at     := coalesce(new.cancelled_at, now());
      when 'REOPENED'    then
        new.reopened_at   := now();
        new.reopen_count  := old.reopen_count + 1;
        new.resolved_at   := null;
        new.closed_at     := null;
        -- Reopening restarts the resolution clock from the reopen instant.
        new.resolution_due_at := app.add_working_minutes(
          now(),
          coalesce((select r.resolution_minutes from public.sla_rules r
                    where r.sla_plan_id = new.sla_plan_id and r.priority_id = new.priority_id), 480),
          new.sla_plan_id);
      else null;
    end case;

    -- First response: the moment an engineer takes ownership.
    if new.first_response_at is null
       and new.status in ('ACCEPTED', 'IN_PROGRESS', 'ON_SITE') then
      new.first_response_at := now();
    end if;

    -- ---- SLA pause accounting -----------------------------------------
    select coalesce(sp.pause_on_hold, true) into v_pause_allowed
    from public.sla_plans sp where sp.id = new.sla_plan_id;

    -- clock_timestamp() rather than now(): now() is frozen for the whole
    -- transaction, so two status changes committed together would record
    -- a zero-length pause and silently under-extend the deadline.
    if v_pause_allowed then
      if app.is_paused_status(new.status) and not app.is_paused_status(old.status) then
        new.paused_since := clock_timestamp();

      elsif not app.is_paused_status(new.status) and app.is_paused_status(old.status)
            and old.paused_since is not null then
        v_paused_ms := greatest(0,
          (extract(epoch from (clock_timestamp() - old.paused_since)) * 1000)::bigint);
        new.paused_ms    := old.paused_ms + v_paused_ms;
        new.paused_since := null;
        -- Push the deadline out by exactly the time the clock was stopped.
        if new.resolution_due_at is not null then
          new.resolution_due_at := new.resolution_due_at + make_interval(secs => v_paused_ms / 1000.0);
        end if;
      end if;
    end if;
  end if;

  -- Reassignment bookkeeping.
  if new.assigned_engineer_id is distinct from old.assigned_engineer_id
     and new.assigned_engineer_id is not null then
    new.assigned_at := now();
    if new.status = 'NEW' then
      new.status := 'ASSIGNED';
    end if;
  end if;

  -- ---- recompute SLA states -------------------------------------------
  select coalesce(sp.at_risk_threshold, 80) into v_threshold
  from public.sla_plans sp where sp.id = new.sla_plan_id;

  new.response_state := case
    when new.response_due_at is null then 'not_applicable'::app.sla_state
    else app.compute_sla_state(new.created_at, new.response_due_at, new.first_response_at, coalesce(v_threshold, 80))
  end;

  new.resolution_state := case
    when new.resolution_due_at is null then 'not_applicable'::app.sla_state
    else app.compute_sla_state(new.created_at, new.resolution_due_at, new.resolved_at, coalesce(v_threshold, 80))
  end;

  new.search_text := lower(concat_ws(' ',
    new.ticket_number, new.subject, new.description,
    new.contact_person, new.contact_phone, new.contact_email));

  return new;
end;
$$;

-- =====================================================================
-- AFTER INSERT - opening timeline entry, assignment row, notifications
-- =====================================================================
create or replace function app.ticket_after_insert()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_actor text;
begin
  select p.full_name into v_actor from public.profiles p where p.id = new.created_by;

  insert into public.ticket_status_history
    (ticket_id, from_status, to_status, event_type, note, changed_by, changed_by_name, metadata)
  values
    (new.id, null, new.status, 'created', 'Ticket created', new.created_by,
     coalesce(v_actor, 'System'),
     jsonb_build_object('ticket_number', new.ticket_number));

  if new.assigned_engineer_id is not null then
    insert into public.ticket_assignments (ticket_id, engineer_id, assigned_by, is_current)
    values (new.id, new.assigned_engineer_id, new.created_by, true);

    insert into public.ticket_status_history
      (ticket_id, to_status, event_type, note, changed_by, changed_by_name)
    select new.id, new.status, 'assigned',
           'Assigned to ' || e.full_name, new.created_by, coalesce(v_actor, 'System')
    from public.employees e where e.id = new.assigned_engineer_id;
  end if;

  perform app.notify_profiles(
    app.ticket_watchers(new.id),
    'ticket.created',
    'New ticket ' || new.ticket_number,
    new.subject,
    'info', new.id, '/tickets/' || new.id
  );

  return new;
end;
$$;

-- =====================================================================
-- AFTER UPDATE - timeline entries and notifications
-- =====================================================================
create or replace function app.ticket_after_update()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_actor_id   uuid := auth.uid();
  v_actor_name text;
  v_eng_name   text;
begin
  select p.full_name into v_actor_name from public.profiles p where p.id = v_actor_id;
  v_actor_name := coalesce(v_actor_name, 'System');

  if new.status is distinct from old.status then
    insert into public.ticket_status_history
      (ticket_id, from_status, to_status, event_type, note, changed_by, changed_by_name, metadata)
    values
      (new.id, old.status, new.status, 'status_change', null, v_actor_id, v_actor_name,
       jsonb_build_object('resolution_summary', new.resolution_summary));

    perform app.notify_profiles(
      app.ticket_watchers(new.id),
      'ticket.status_changed',
      new.ticket_number || ' is now ' || replace(new.status::text, '_', ' '),
      new.subject,
      case when new.status in ('RESOLVED','CLOSED') then 'success'
           when new.status = 'REOPENED' then 'warning'
           else 'info' end,
      new.id, '/tickets/' || new.id
    );
  end if;

  if new.assigned_engineer_id is distinct from old.assigned_engineer_id then
    update public.ticket_assignments
       set is_current = false, released_at = now()
     where ticket_id = new.id and is_current;

    if new.assigned_engineer_id is not null then
      insert into public.ticket_assignments (ticket_id, engineer_id, assigned_by, is_current)
      values (new.id, new.assigned_engineer_id, v_actor_id, true);

      select e.full_name into v_eng_name
      from public.employees e where e.id = new.assigned_engineer_id;

      insert into public.ticket_status_history
        (ticket_id, from_status, to_status, event_type, note, changed_by, changed_by_name)
      values (new.id, old.status, new.status, 'assignment',
              'Assigned to ' || coalesce(v_eng_name, 'engineer'), v_actor_id, v_actor_name);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ticket_before_insert on public.tickets;
create trigger trg_ticket_before_insert
  before insert on public.tickets
  for each row execute function app.ticket_before_insert();

drop trigger if exists trg_ticket_before_update on public.tickets;
create trigger trg_ticket_before_update
  before update on public.tickets
  for each row execute function app.ticket_before_update();

drop trigger if exists trg_ticket_after_insert on public.tickets;
create trigger trg_ticket_after_insert
  after insert on public.tickets
  for each row execute function app.ticket_after_insert();

drop trigger if exists trg_ticket_after_update on public.tickets;
create trigger trg_ticket_after_update
  after update on public.tickets
  for each row execute function app.ticket_after_update();

-- ---------------------------------------------------------------------
-- Service report numbering
-- ---------------------------------------------------------------------
create or replace function app.service_report_before_insert()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
begin
  if new.report_number is null or btrim(new.report_number) = '' then
    new.report_number := app.next_document_number(
      'service_report',
      app.setting_text('report_prefix', 'SR'),
      to_char(now() at time zone 'Asia/Dubai', 'YYYY'),
      coalesce(nullif(app.setting_text('report_number_width', '6'), '')::int, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_service_report_number on public.service_reports;
create trigger trg_service_report_number
  before insert on public.service_reports
  for each row execute function app.service_report_before_insert();

-- ---------------------------------------------------------------------
-- AMC numbering
-- ---------------------------------------------------------------------
create or replace function app.amc_before_insert()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
begin
  if new.amc_number is null or btrim(new.amc_number) = '' then
    new.amc_number := app.next_document_number('amc', 'AMC',
      to_char(now() at time zone 'Asia/Dubai', 'YYYY'), 4);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_amc_number on public.amc_contracts;
create trigger trg_amc_number
  before insert on public.amc_contracts
  for each row execute function app.amc_before_insert();

-- ---------------------------------------------------------------------
-- Asset tag numbering
-- ---------------------------------------------------------------------
create or replace function app.asset_before_insert()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
begin
  if new.asset_tag is null or btrim(new.asset_tag) = '' then
    new.asset_tag := app.next_document_number('asset', 'AST', 'ALL', 6);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_asset_tag on public.assets;
create trigger trg_asset_tag
  before insert on public.assets
  for each row execute function app.asset_before_insert();

-- ---------------------------------------------------------------------
-- Comments and feedback raise notifications too.
-- ---------------------------------------------------------------------
create or replace function app.comment_after_insert()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_number text;
begin
  select t.ticket_number into v_number from public.tickets t where t.id = new.ticket_id;

  perform app.notify_profiles(
    app.ticket_watchers(new.ticket_id),
    'ticket.comment',
    'New comment on ' || v_number,
    left(new.body, 160),
    'info', new.ticket_id, '/tickets/' || new.ticket_id
  );
  return new;
end;
$$;

drop trigger if exists trg_comment_after_insert on public.ticket_comments;
create trigger trg_comment_after_insert
  after insert on public.ticket_comments
  for each row when (not new.is_system) execute function app.comment_after_insert();

create or replace function app.feedback_after_insert()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_number text;
begin
  select t.ticket_number into v_number from public.tickets t where t.id = new.ticket_id;

  insert into public.ticket_status_history
    (ticket_id, to_status, event_type, note, changed_by_name, metadata)
  select new.ticket_id, t.status, 'feedback',
         'Customer rated the service ' || new.overall_rating || '/5', 'Customer',
         jsonb_build_object('overall_rating', new.overall_rating)
  from public.tickets t where t.id = new.ticket_id;

  perform app.notify_profiles(
    app.ticket_watchers(new.ticket_id),
    'feedback.received',
    'Feedback received for ' || v_number,
    new.overall_rating || '/5 - ' || coalesce(left(new.comments, 120), 'No comments'),
    case when new.overall_rating <= 2 then 'warning' else 'success' end,
    new.ticket_id, '/tickets/' || new.ticket_id
  );
  return new;
end;
$$;

drop trigger if exists trg_feedback_after_insert on public.customer_feedback;
create trigger trg_feedback_after_insert
  after insert on public.customer_feedback
  for each row execute function app.feedback_after_insert();

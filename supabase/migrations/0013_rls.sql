-- =====================================================================
-- RCT APPLICATION | Migration 0013 - Row Level Security
--
-- Tenant isolation is enforced here, in the database. The application
-- layer performs its own permission checks as well, but every one of
-- them is redundant: a compromised or buggy API route still cannot read
-- another customer's tickets, because Postgres will not return the rows.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Central visibility rule for a ticket. Every ticket child table defers
-- to this so the rules can never drift apart.
-- ---------------------------------------------------------------------
create or replace function app.can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and (
        app.is_management()
        or (
          app.is_engineer() and (
            t.assigned_engineer_id = app.current_employee_id()
            or t.service_manager_id = app.current_employee_id()
            or exists (
              select 1 from public.employee_customers ec
              where ec.employee_id = app.current_employee_id()
                and ec.customer_id = t.customer_id
            )
          )
        )
        or t.customer_id = app.current_customer_id()
      )
  )
$$;

create or replace function app.can_modify_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1
    from public.tickets t
    where t.id = p_ticket_id
      and t.status not in ('CLOSED', 'CANCELLED')
      and (
        app.is_management()
        or (app.is_engineer() and (
              t.assigned_engineer_id = app.current_employee_id()
              or t.service_manager_id = app.current_employee_id()
           ))
      )
  )
$$;

-- Customers a staff principal may see (management sees all).
create or replace function app.can_access_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select
    app.is_management()
    or p_customer_id = app.current_customer_id()
    or (app.is_engineer() and exists (
          select 1 from public.employee_customers ec
          where ec.employee_id = app.current_employee_id()
            and ec.customer_id = p_customer_id
       ))
    or (app.is_engineer() and exists (
          select 1 from public.tickets t
          where t.customer_id = p_customer_id
            and t.assigned_engineer_id = app.current_employee_id()
       ))
$$;

-- =====================================================================
-- Enable RLS everywhere in `public`, then grant deliberately.
-- =====================================================================
do $$
declare r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- The RLS policies below call app.* helpers, and policy expressions are
-- evaluated with the *caller's* privileges. Without USAGE on the schema
-- every policy raises "permission denied for schema app" and the whole
-- application fails closed.
grant usage on schema app to authenticated, service_role;
grant execute on all functions in schema app to authenticated;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default, so the
-- privileged helpers have to be withdrawn explicitly. Each of these is
-- SECURITY DEFINER and is only ever meant to be reached from a trigger or
-- from the server using the service role - never from a browser session,
-- which could otherwise forge audit entries, mint document numbers or
-- spray notifications at other users.
do $$
declare fn text;
begin
  foreach fn in array array[
    'app.audit_event(text,text,text,text,text,jsonb)',
    'app.audit_row()',
    'app.notify_profiles(uuid[],text,text,text,text,uuid,text,jsonb)',
    'app.next_document_number(text,text,text,int)',
    'app.sweep_sla()',
    'app.refresh_amc_statuses()',
    'app.attach_touch_trigger(regclass)',
    'app.guard_profile_escalation()'
  ] loop
    begin
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
    exception when undefined_function then
      null;   -- tolerated: lets this migration run before 0014 exists
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Reference data: readable by every authenticated principal,
-- writable only by administrators.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'roles','permissions','role_permissions','categories','subcategories',
    'priorities','sla_plans','sla_rules','business_hours','holidays',
    'asset_types','skills','departments','parts_catalogue'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (app.is_admin()) with check (app.is_admin())',
      t || '_admin_write', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or app.is_management()
    -- Staff need to see each other to assign work.
    or (app.is_staff() and role not in ('customer_admin','customer_user'))
    -- A customer principal sees the contacts of their own company.
    or (customer_id is not null and customer_id = app.current_customer_id())
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or app.is_admin())
  with check (id = auth.uid() or app.is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for insert to authenticated
  with check (app.is_admin());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (app.is_admin());

-- A non-admin must never be able to escalate their own role or
-- re-point their tenant scope. Enforced with a trigger because RLS
-- cannot express "this column may not change".
create or replace function app.guard_profile_escalation()
returns trigger
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
begin
  -- No JWT present == a trusted server-side context (service role key,
  -- migrations, seed scripts). Browser sessions always carry a JWT, and
  -- anon has no UPDATE policy on profiles, so this cannot be spoofed.
  if auth.uid() is null or app.is_admin() then
    return new;
  end if;

  if new.role        is distinct from old.role
     or new.customer_id is distinct from old.customer_id
     or new.employee_id is distinct from old.employee_id
     or new.is_active   is distinct from old.is_active then
    raise exception 'You are not permitted to change role, tenant scope or activation state'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_escalation on public.profiles;
create trigger trg_guard_profile_escalation
  before update on public.profiles
  for each row execute function app.guard_profile_escalation();

-- ---------------------------------------------------------------------
-- customers / branches / customer_users
-- ---------------------------------------------------------------------
drop policy if exists customers_read on public.customers;
create policy customers_read on public.customers
  for select to authenticated
  using (app.can_access_customer(id));

drop policy if exists customers_write on public.customers;
create policy customers_write on public.customers
  for all to authenticated
  using (app.is_management()) with check (app.is_management());

drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches
  for select to authenticated
  using (app.can_access_customer(customer_id));

drop policy if exists branches_write on public.branches;
create policy branches_write on public.branches
  for all to authenticated
  using (app.is_management()) with check (app.is_management());

drop policy if exists customer_users_read on public.customer_users;
create policy customer_users_read on public.customer_users
  for select to authenticated
  using (app.is_management() or customer_id = app.current_customer_id());

drop policy if exists customer_users_write on public.customer_users;
create policy customer_users_write on public.customer_users
  for all to authenticated
  using (app.is_management() or (app.is_customer_admin() and customer_id = app.current_customer_id()))
  with check (app.is_management() or (app.is_customer_admin() and customer_id = app.current_customer_id()));

-- ---------------------------------------------------------------------
-- employees and related
-- ---------------------------------------------------------------------
drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees
  for select to authenticated
  using (
    app.is_staff()
    -- Customers may see the engineer working their ticket, nothing more.
    or exists (
      select 1 from public.tickets t
      where t.customer_id = app.current_customer_id()
        and (t.assigned_engineer_id = employees.id or t.service_manager_id = employees.id)
    )
  );

drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

drop policy if exists employees_self_update on public.employees;
create policy employees_self_update on public.employees
  for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'employee_skills','employee_certifications','employee_customers','employee_branches'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app.is_staff())',
      t || '_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (app.is_management()) with check (app.is_management())',
      t || '_write', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- tickets
-- ---------------------------------------------------------------------
drop policy if exists tickets_read on public.tickets;
create policy tickets_read on public.tickets
  for select to authenticated
  using (
    app.is_management()
    or (app.is_engineer() and (
          assigned_engineer_id = app.current_employee_id()
          or service_manager_id = app.current_employee_id()
          or exists (
            select 1 from public.employee_customers ec
            where ec.employee_id = app.current_employee_id()
              and ec.customer_id = tickets.customer_id
          )
       ))
    or customer_id = app.current_customer_id()
  );

drop policy if exists tickets_insert on public.tickets;
create policy tickets_insert on public.tickets
  for insert to authenticated
  with check (
    app.is_management()
    or app.is_engineer()
    -- A customer principal may only ever raise a ticket against their own company.
    or customer_id = app.current_customer_id()
  );

drop policy if exists tickets_update on public.tickets;
create policy tickets_update on public.tickets
  for update to authenticated
  using (
    app.is_management()
    or (app.is_engineer() and (
          assigned_engineer_id = app.current_employee_id()
          or service_manager_id = app.current_employee_id()
       ))
  )
  with check (
    app.is_management()
    or (app.is_engineer() and (
          assigned_engineer_id = app.current_employee_id()
          or service_manager_id = app.current_employee_id()
       ))
  );

comment on policy tickets_update on public.tickets is
  'Customers deliberately have no direct UPDATE path. Customer-initiated actions (reopen, approve work, add remarks) go through SECURITY DEFINER RPCs in 0014 that validate the request first.';

drop policy if exists tickets_delete on public.tickets;
create policy tickets_delete on public.tickets
  for delete to authenticated
  using (app.is_admin());

-- ---------------------------------------------------------------------
-- Ticket children - all defer to app.can_access_ticket()
-- ---------------------------------------------------------------------
drop policy if exists ticket_status_history_read on public.ticket_status_history;
create policy ticket_status_history_read on public.ticket_status_history
  for select to authenticated
  using (app.can_access_ticket(ticket_id));

drop policy if exists ticket_status_history_insert on public.ticket_status_history;
create policy ticket_status_history_insert on public.ticket_status_history
  for insert to authenticated
  with check (app.is_staff() and app.can_access_ticket(ticket_id));

-- Comments: internal notes are invisible to customers.
drop policy if exists ticket_comments_read on public.ticket_comments;
create policy ticket_comments_read on public.ticket_comments
  for select to authenticated
  using (
    app.can_access_ticket(ticket_id)
    and (not is_internal or app.is_staff())
  );

drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments
  for insert to authenticated
  with check (
    app.can_access_ticket(ticket_id)
    and author_id = auth.uid()
    -- A customer can never author an internal note.
    and (not is_internal or app.is_staff())
  );

drop policy if exists ticket_comments_update on public.ticket_comments;
create policy ticket_comments_update on public.ticket_comments
  for update to authenticated
  using (author_id = auth.uid() or app.is_admin())
  with check (author_id = auth.uid() or app.is_admin());

drop policy if exists ticket_attachments_read on public.ticket_attachments;
create policy ticket_attachments_read on public.ticket_attachments
  for select to authenticated
  using (app.can_access_ticket(ticket_id) and (not is_internal or app.is_staff()));

drop policy if exists ticket_attachments_insert on public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments
  for insert to authenticated
  with check (app.can_access_ticket(ticket_id) and uploaded_by = auth.uid());

drop policy if exists ticket_attachments_delete on public.ticket_attachments;
create policy ticket_attachments_delete on public.ticket_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or app.is_management());

drop policy if exists ticket_assignments_read on public.ticket_assignments;
create policy ticket_assignments_read on public.ticket_assignments
  for select to authenticated
  using (app.can_access_ticket(ticket_id));

drop policy if exists ticket_assignments_write on public.ticket_assignments;
create policy ticket_assignments_write on public.ticket_assignments
  for all to authenticated
  using (app.is_management()) with check (app.is_management());

-- Parts, labour and visits are operational data: staff only.
do $$
declare t text;
begin
  foreach t in array array['ticket_parts','ticket_time_entries','ticket_visits'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (app.can_access_ticket(ticket_id) and app.is_staff())',
      t || '_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (app.can_modify_ticket(ticket_id))
         with check (app.can_modify_ticket(ticket_id))',
      t || '_write', t);
  end loop;
end $$;

-- Customers are allowed to see the parts consumed on their own tickets
-- once the work is finished - it is printed on their service report.
drop policy if exists ticket_parts_customer_read on public.ticket_parts;
create policy ticket_parts_customer_read on public.ticket_parts
  for select to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_parts.ticket_id
        and t.customer_id = app.current_customer_id()
        and t.status in ('RESOLVED','CLOSED')
    )
  );

-- ---------------------------------------------------------------------
-- Service reports, signatures, feedback, approvals
-- ---------------------------------------------------------------------
drop policy if exists service_reports_read on public.service_reports;
create policy service_reports_read on public.service_reports
  for select to authenticated
  using (app.can_access_ticket(ticket_id));

drop policy if exists service_reports_write on public.service_reports;
create policy service_reports_write on public.service_reports
  for all to authenticated
  using (app.is_staff() and app.can_access_ticket(ticket_id))
  with check (app.is_staff() and app.can_access_ticket(ticket_id));

drop policy if exists customer_signatures_read on public.customer_signatures;
create policy customer_signatures_read on public.customer_signatures
  for select to authenticated
  using (app.can_access_ticket(ticket_id));

drop policy if exists customer_signatures_insert on public.customer_signatures;
create policy customer_signatures_insert on public.customer_signatures
  for insert to authenticated
  with check (app.can_access_ticket(ticket_id));

-- Signatures are evidence: never editable, never deletable through the API.
comment on table public.customer_signatures is
  'Append-only by policy: no UPDATE or DELETE policy exists for any role.';

drop policy if exists customer_feedback_read on public.customer_feedback;
create policy customer_feedback_read on public.customer_feedback
  for select to authenticated
  using (app.is_staff() or customer_id = app.current_customer_id());

drop policy if exists customer_feedback_insert on public.customer_feedback;
create policy customer_feedback_insert on public.customer_feedback
  for insert to authenticated
  with check (
    customer_id = app.current_customer_id()
    and exists (
      select 1 from public.tickets t
      where t.id = customer_feedback.ticket_id
        and t.customer_id = app.current_customer_id()
        and t.status in ('RESOLVED','CLOSED')
    )
  );

drop policy if exists work_approvals_read on public.work_approvals;
create policy work_approvals_read on public.work_approvals
  for select to authenticated
  using (app.can_access_ticket(ticket_id));

drop policy if exists work_approvals_write on public.work_approvals;
create policy work_approvals_write on public.work_approvals
  for all to authenticated
  using (app.is_staff() and app.can_access_ticket(ticket_id))
  with check (app.is_staff() and app.can_access_ticket(ticket_id));

-- ---------------------------------------------------------------------
-- AMC and assets
-- ---------------------------------------------------------------------
drop policy if exists amc_read on public.amc_contracts;
create policy amc_read on public.amc_contracts
  for select to authenticated
  using (app.can_access_customer(customer_id));

drop policy if exists amc_write on public.amc_contracts;
create policy amc_write on public.amc_contracts
  for all to authenticated
  using (app.is_management()) with check (app.is_management());

do $$
declare t text;
begin
  foreach t in array array['amc_branches','amc_engineers'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (app.is_staff())',
      t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (app.is_management()) with check (app.is_management())',
      t || '_write', t);
  end loop;
end $$;

drop policy if exists assets_read on public.assets;
create policy assets_read on public.assets
  for select to authenticated
  using (app.can_access_customer(customer_id));

drop policy if exists assets_write on public.assets;
create policy assets_write on public.assets
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- ---------------------------------------------------------------------
-- Notifications - strictly the recipient's own
-- ---------------------------------------------------------------------
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated
  using (recipient_id = auth.uid());

-- ---------------------------------------------------------------------
-- Email
-- ---------------------------------------------------------------------
drop policy if exists email_templates_read on public.email_templates;
create policy email_templates_read on public.email_templates
  for select to authenticated using (app.is_management());

drop policy if exists email_templates_write on public.email_templates;
create policy email_templates_write on public.email_templates
  for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

drop policy if exists email_logs_read on public.email_logs;
create policy email_logs_read on public.email_logs
  for select to authenticated
  using (app.is_management() or (ticket_id is not null and app.can_access_ticket(ticket_id)));

-- Email rows are written by the server (service_role), never by a browser.

-- ---------------------------------------------------------------------
-- Audit log - readable by management, append-only for everyone
-- ---------------------------------------------------------------------
drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs
  for select to authenticated
  using (app.is_management());

revoke insert, update, delete on public.audit_logs from authenticated;
revoke update, delete on public.audit_logs from authenticated;

-- ---------------------------------------------------------------------
-- System settings - secrets never leave the server
-- ---------------------------------------------------------------------
drop policy if exists system_settings_read on public.system_settings;
create policy system_settings_read on public.system_settings
  for select to authenticated
  using (not is_secret and app.is_staff());

drop policy if exists system_settings_write on public.system_settings;
create policy system_settings_write on public.system_settings
  for all to authenticated
  using (app.is_admin() and not is_secret)
  with check (app.is_admin() and not is_secret);

comment on table public.system_settings is
  'Rows flagged is_secret (SMTP credentials, API keys) are invisible to every browser session. Only the server, using the service role key, can read or write them.';

-- ---------------------------------------------------------------------
-- Numbering table is internal machinery.
-- ---------------------------------------------------------------------
revoke all on public.number_sequences from authenticated, anon;

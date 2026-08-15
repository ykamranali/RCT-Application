-- =====================================================================
-- RCT APPLICATION | Test suite 2 - Row Level Security / tenant isolation
--
-- Requires the seed data:
--   psql "$DATABASE_URL" -f supabase/seed/seed.sql
--   psql "$DATABASE_URL" -f supabase/tests/02_rls_isolation.sql
--
-- Every assertion runs as the `authenticated` role with a JWT subject
-- set, which is exactly how PostgREST executes a browser request. The
-- superuser connection is only used to set up and to record results.
-- =====================================================================

\set ON_ERROR_STOP on
\timing off

begin;

create temporary table _results (
  id serial primary key, name text, passed boolean, detail text
);
grant all on _results to public;
grant all on _results_id_seq to public;

-- ---------------------------------------------------------------------
-- Run a scalar query as a given principal, exactly as PostgREST would.
-- ---------------------------------------------------------------------
create or replace function pg_temp.as_user(p_user uuid, p_sql text)
returns bigint
language plpgsql
as $$
declare v bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  execute p_sql into v;
  reset role;
  return v;
exception when others then
  reset role;
  raise;
end $$;

-- Run DML as a principal and report how many rows it actually touched.
create or replace function pg_temp.dml_as_user(p_user uuid, p_sql text)
returns bigint
language plpgsql
as $$
declare v bigint;
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  execute p_sql;
  get diagnostics v = row_count;
  reset role;
  return v;
exception when others then
  reset role;
  raise;
end $$;

-- Assert that an operation is rejected outright.
create or replace function pg_temp.denied(p_name text, p_user uuid, p_sql text)
returns void
language plpgsql
as $$
begin
  perform pg_temp.dml_as_user(p_user, p_sql);
  insert into _results (name, passed, detail)
  values (p_name, false, 'the operation was allowed');
exception when others then
  insert into _results (name, passed, detail)
  values (p_name, true, 'rejected: ' || sqlerrm);
end $$;

create or replace function pg_temp.check_eq(p_name text, p_actual bigint, p_expected bigint)
returns void language plpgsql as $$
begin
  insert into _results (name, passed, detail)
  values (p_name, p_actual is not distinct from p_expected,
          format('expected=%s actual=%s', p_expected, p_actual));
end $$;

create or replace function pg_temp.check_true(p_name text, p_actual boolean, p_detail text default null)
returns void language plpgsql as $$
begin
  insert into _results (name, passed, detail) values (p_name, coalesce(p_actual,false), p_detail);
end $$;

-- =====================================================================
do $$
declare
  v_cust_a      uuid;   -- Gulf Horizon
  v_cust_b      uuid;   -- a different customer
  v_admin_a     uuid;   -- customer_admin of A
  v_user_a      uuid;   -- customer_user of A
  v_admin_b     uuid;   -- customer_admin of B
  v_engineer    uuid;   -- profile id of an engineer with an assigned ticket
  v_engineer_emp uuid;
  v_other_eng   uuid;
  v_mgmt        uuid;
  v_super       uuid;
  v_ticket_a    uuid;
  v_ticket_b    uuid;
  v_total       bigint;
  n             bigint;
begin
  select id into v_cust_a from public.customers where customer_code = 'CUS-0001';
  select id into v_cust_b from public.customers where customer_code = 'CUS-0002';

  select id into v_admin_a from public.profiles
   where customer_id = v_cust_a and role = 'customer_admin' limit 1;
  select id into v_user_a from public.profiles
   where customer_id = v_cust_a and role = 'customer_user' limit 1;
  select id into v_admin_b from public.profiles
   where customer_id = v_cust_b and role = 'customer_admin' limit 1;

  select id into v_mgmt  from public.profiles where role = 'management'  limit 1;
  select id into v_super from public.profiles where role = 'super_admin' limit 1;

  select id into v_ticket_a from public.tickets where customer_id = v_cust_a limit 1;
  select id into v_ticket_b from public.tickets where customer_id = v_cust_b limit 1;

  -- An engineer who actually has an assigned ticket.
  select e.profile_id, e.id into v_engineer, v_engineer_emp
  from public.employees e
  where e.role = 'engineer'
    and exists (select 1 from public.tickets t where t.assigned_engineer_id = e.id)
  limit 1;

  select e.profile_id into v_other_eng
  from public.employees e
  where e.role = 'engineer' and e.id <> v_engineer_emp
  limit 1;

  select count(*) into v_total from public.tickets;

  -- ==================================================================
  -- Customer tenant isolation
  -- ==================================================================
  perform pg_temp.check_eq(
    'Customer A sees exactly their own tickets',
    pg_temp.as_user(v_admin_a, 'select count(*) from public.tickets'),
    (select count(*) from public.tickets where customer_id = v_cust_a));

  perform pg_temp.check_eq(
    'Customer A sees zero tickets belonging to customer B',
    pg_temp.as_user(v_admin_a,
      format('select count(*) from public.tickets where customer_id = %L', v_cust_b)),
    0::bigint);

  perform pg_temp.check_true(
    'Customer A cannot see the whole ticket table',
    pg_temp.as_user(v_admin_a, 'select count(*) from public.tickets') < v_total,
    format('customer sees %s of %s',
           pg_temp.as_user(v_admin_a, 'select count(*) from public.tickets'), v_total));

  perform pg_temp.check_eq(
    'A named ticket of customer B is invisible to customer A',
    pg_temp.as_user(v_admin_a,
      format('select count(*) from public.tickets where id = %L', v_ticket_b)),
    0::bigint);

  perform pg_temp.check_eq(
    'Customer A cannot read customer B''s company record',
    pg_temp.as_user(v_admin_a,
      format('select count(*) from public.customers where id = %L', v_cust_b)),
    0::bigint);

  perform pg_temp.check_eq(
    'Customer A cannot read customer B''s branches',
    pg_temp.as_user(v_admin_a,
      format('select count(*) from public.branches where customer_id = %L', v_cust_b)),
    0::bigint);

  perform pg_temp.check_eq(
    'Customer A cannot read customer B''s assets',
    pg_temp.as_user(v_admin_a,
      format('select count(*) from public.assets where customer_id = %L', v_cust_b)),
    0::bigint);

  perform pg_temp.check_eq(
    'Customer A cannot read customer B''s AMC contracts',
    pg_temp.as_user(v_admin_a,
      format('select count(*) from public.amc_contracts where customer_id = %L', v_cust_b)),
    0::bigint);

  perform pg_temp.check_eq(
    'Customer A cannot read customer B''s service reports',
    pg_temp.as_user(v_admin_a,
      format('select count(*) from public.service_reports where customer_id = %L', v_cust_b)),
    0::bigint);

  -- The reporting view must respect RLS too (security_invoker).
  perform pg_temp.check_eq(
    'The overview view is tenant-scoped as well',
    pg_temp.as_user(v_admin_a,
      format('select count(*) from public.v_tickets_overview where customer_id = %L', v_cust_b)),
    0::bigint);

  -- ==================================================================
  -- Internal notes are never exposed to customers
  -- ==================================================================
  perform pg_temp.check_eq(
    'Customers cannot read internal engineer notes',
    pg_temp.as_user(v_admin_a,
      'select count(*) from public.ticket_comments where is_internal'),
    0::bigint);

  perform pg_temp.check_true(
    'Staff can read internal engineer notes',
    pg_temp.as_user(v_mgmt,
      'select count(*) from public.ticket_comments where is_internal') > 0);

  perform pg_temp.check_true(
    'Customers can still read the public conversation',
    pg_temp.as_user(v_admin_a,
      'select count(*) from public.ticket_comments where not is_internal') > 0);

  -- ==================================================================
  -- Customers have no direct write path onto tickets
  -- ==================================================================
  perform pg_temp.check_eq(
    'Customer cannot update another tenant''s ticket',
    pg_temp.dml_as_user(v_admin_a,
      format('update public.tickets set subject = ''hijacked'' where id = %L', v_ticket_b)),
    0::bigint);

  perform pg_temp.check_eq(
    'Customer cannot update even their own ticket directly',
    pg_temp.dml_as_user(v_admin_a,
      format('update public.tickets set status = ''CLOSED'' where id = %L', v_ticket_a)),
    0::bigint);

  perform pg_temp.denied(
    'Customer cannot raise a ticket against another company',
    v_admin_a,
    format($f$insert into public.tickets (customer_id, priority_id, subject, description)
              values (%L, (select id from public.priorities where code = 'LOW'),
                      'Cross-tenant insert', 'This insert must be rejected by RLS.')$f$, v_cust_b));

  perform pg_temp.check_eq(
    'Customer cannot delete a ticket',
    pg_temp.dml_as_user(v_admin_a,
      format('delete from public.tickets where id = %L', v_ticket_a)),
    0::bigint);

  -- ==================================================================
  -- Privileged data is invisible to customers
  -- ==================================================================
  perform pg_temp.check_eq(
    'Customers cannot read the audit log',
    pg_temp.as_user(v_admin_a, 'select count(*) from public.audit_logs'),
    0::bigint);

  perform pg_temp.check_eq(
    'Customers cannot read system settings',
    pg_temp.as_user(v_admin_a, 'select count(*) from public.system_settings'),
    0::bigint);

  perform pg_temp.check_eq(
    'Secret settings are invisible even to staff',
    pg_temp.as_user(v_mgmt,
      'select count(*) from public.system_settings where is_secret'),
    0::bigint);

  perform pg_temp.check_true(
    'Non-secret settings are readable by staff',
    pg_temp.as_user(v_mgmt, 'select count(*) from public.system_settings') > 0);

  perform pg_temp.check_eq(
    'Customers cannot read email templates',
    pg_temp.as_user(v_admin_a, 'select count(*) from public.email_templates'),
    0::bigint);

  -- A customer may see the engineer and the service manager attached to
  -- their own tickets, and nobody else on the roster.
  perform pg_temp.check_eq(
    'Customers cannot enumerate the wider employee roster',
    pg_temp.as_user(v_admin_a,
      format($f$select count(*) from public.employees e
              where not exists (
                select 1 from public.tickets t
                where t.customer_id = %L
                  and (t.assigned_engineer_id = e.id or t.service_manager_id = e.id))$f$,
             v_cust_a)),
    0::bigint);

  perform pg_temp.check_true(
    'Customers can see the engineer working their ticket',
    pg_temp.as_user(v_admin_a, 'select count(*) from public.employees') > 0);

  -- ==================================================================
  -- Engineer scoping
  -- ==================================================================
  perform pg_temp.check_true(
    'Engineer sees their assigned tickets',
    pg_temp.as_user(v_engineer,
      format('select count(*) from public.tickets where assigned_engineer_id = %L', v_engineer_emp)) > 0);

  -- The precise property, rather than "sees fewer than all": an engineer
  -- may legitimately cover every customer, so a raw count comparison is not
  -- a security assertion. What must never happen is visibility of a ticket
  -- that is neither theirs nor within their assigned coverage.
  perform pg_temp.check_eq(
    'Engineer sees no ticket outside their assignments and coverage',
    pg_temp.as_user(v_engineer,
      format($f$select count(*) from public.tickets t
              where t.assigned_engineer_id is distinct from %L
                and t.service_manager_id  is distinct from %L
                and t.customer_id not in (
                  select ec.customer_id from public.employee_customers ec
                  where ec.employee_id = %L
                )$f$, v_engineer_emp, v_engineer_emp, v_engineer_emp)),
    0::bigint);

  -- And an engineer with genuinely narrow coverage must see strictly less
  -- than the whole table, which proves the predicate is doing real work.
  declare
    v_narrow uuid;
    v_narrow_emp uuid;
  begin
    select e.profile_id, e.id into v_narrow, v_narrow_emp
    from public.employees e
    where e.role = 'engineer'
      and e.profile_id is not null
      and (select count(*) from public.employee_customers ec where ec.employee_id = e.id)
          < (select count(*) from public.customers)
    order by (select count(*) from public.employee_customers ec where ec.employee_id = e.id)
    limit 1;

    if v_narrow is not null then
      perform pg_temp.check_true(
        'An engineer with partial coverage sees only part of the table',
        pg_temp.as_user(v_narrow, 'select count(*) from public.tickets') < v_total,
        format('narrow engineer sees %s of %s',
               pg_temp.as_user(v_narrow, 'select count(*) from public.tickets'), v_total));
    end if;
  end;

  perform pg_temp.check_eq(
    'Engineer cannot update a ticket assigned to someone else',
    pg_temp.dml_as_user(v_engineer,
      format($f$update public.tickets set engineer_remarks = 'not mine'
              where assigned_engineer_id <> %L
                and assigned_engineer_id is not null$f$, v_engineer_emp)),
    0::bigint);

  perform pg_temp.check_eq(
    'Engineer cannot delete tickets',
    pg_temp.dml_as_user(v_engineer, 'delete from public.tickets'),
    0::bigint);

  perform pg_temp.check_eq(
    'Engineer cannot read the audit log',
    pg_temp.as_user(v_engineer, 'select count(*) from public.audit_logs'),
    0::bigint);

  -- ==================================================================
  -- Management / admin scope
  -- ==================================================================
  perform pg_temp.check_eq(
    'Management sees every ticket',
    pg_temp.as_user(v_mgmt, 'select count(*) from public.tickets'),
    v_total);

  perform pg_temp.check_true(
    'Management can read the audit log',
    pg_temp.as_user(v_mgmt, 'select count(*) from public.audit_logs') > 0);

  perform pg_temp.check_eq(
    'Super admin sees every ticket',
    pg_temp.as_user(v_super, 'select count(*) from public.tickets'),
    v_total);

  -- ==================================================================
  -- Privilege escalation
  -- ==================================================================
  perform pg_temp.denied(
    'A customer cannot promote themselves to admin',
    v_admin_a,
    format('update public.profiles set role = ''super_admin'' where id = %L', v_admin_a));

  perform pg_temp.denied(
    'An engineer cannot promote themselves to admin',
    v_engineer,
    format('update public.profiles set role = ''admin'' where id = %L', v_engineer));

  perform pg_temp.denied(
    'A customer cannot move themselves into another tenant',
    v_admin_a,
    format('update public.profiles set customer_id = %L where id = %L', v_cust_b, v_admin_a));

  perform pg_temp.check_eq(
    'A customer cannot deactivate another user',
    pg_temp.dml_as_user(v_admin_a,
      format('update public.profiles set is_active = false where id = %L', v_admin_b)),
    0::bigint);

  -- A user may still edit their own harmless profile fields.
  perform pg_temp.check_eq(
    'A user can still update their own display name',
    pg_temp.dml_as_user(v_admin_a,
      format('update public.profiles set full_name = full_name where id = %L', v_admin_a)),
    1::bigint);

  -- ==================================================================
  -- Notifications are strictly personal
  -- ==================================================================
  perform pg_temp.check_eq(
    'A user only sees their own notifications',
    pg_temp.as_user(v_mgmt,
      format('select count(*) from public.notifications where recipient_id <> %L', v_mgmt)),
    0::bigint);

  -- ==================================================================
  -- Feedback cannot be forged across tenants
  -- ==================================================================
  perform pg_temp.denied(
    'Customer A cannot leave feedback on customer B''s ticket',
    v_admin_a,
    format($f$insert into public.customer_feedback (ticket_id, customer_id, overall_rating)
              values (%L, %L, 5)$f$, v_ticket_b, v_cust_b));

  -- ==================================================================
  -- Signatures are evidence: append-only
  -- ==================================================================
  perform pg_temp.check_eq(
    'Signatures cannot be edited by staff',
    pg_temp.dml_as_user(v_mgmt,
      'update public.customer_signatures set signer_name = ''forged'''),
    0::bigint);

  perform pg_temp.check_eq(
    'Signatures cannot be deleted by staff',
    pg_temp.dml_as_user(v_mgmt, 'delete from public.customer_signatures'),
    0::bigint);

  -- ==================================================================
  -- Audit log is append-only for every role
  -- ==================================================================
  perform pg_temp.denied(
    'Nobody can rewrite the audit log',
    v_super,
    'update public.audit_logs set summary = ''rewritten''');

  perform pg_temp.denied(
    'Nobody can delete from the audit log',
    v_super,
    'delete from public.audit_logs');

  -- ==================================================================
  -- Anonymous access
  -- ==================================================================
  begin
    set local role anon;
    begin
      execute 'select count(*) from public.tickets' into n;
      insert into _results (name, passed, detail)
      values ('Anonymous cannot read tickets', n = 0, format('rows visible=%s', n));
    exception when others then
      insert into _results (name, passed, detail)
      values ('Anonymous cannot read tickets', true, 'rejected: ' || sqlerrm);
    end;
    reset role;
  end;
end $$;

-- =====================================================================
\echo ''
\echo '=============== ROW LEVEL SECURITY TEST RESULTS ==============='
select case when passed then '  PASS' else '  FAIL' end as result,
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
    raise exception '% RLS test(s) failed - tenant isolation is not safe', v_failed;
  end if;
  raise notice 'All row level security tests passed.';
end $$;

rollback;

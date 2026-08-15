-- =====================================================================
-- RCT APPLICATION | Development seed data
--
-- Fictional data for local development and demonstration only.
-- Run AFTER all migrations:  psql "$DATABASE_URL" -f supabase/seed/seed.sql
--
-- Every demo account uses the password documented in docs/DEMO_ACCOUNTS.md
-- and is flagged must_change_password. Never load this into production.
-- =====================================================================

begin;

-- Guard: refuse to run against a database that already holds real tickets
-- that were not created by this seed.
do $$
begin
  if exists (
    select 1 from public.tickets
    where created_at < now() - interval '365 days'
  ) then
    raise exception 'Refusing to seed: this database already contains historical tickets.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Clean previous demo data, leaving the baseline configuration from the
-- migrations intact.
--
-- Deliberately DELETE rather than TRUNCATE ... CASCADE: profiles.branch_id
-- references branches, so a cascading truncate would reach profiles and
-- from there wipe system_settings and email_templates, which are
-- configuration, not demo data.
-- ---------------------------------------------------------------------
delete from public.customer_feedback;
delete from public.work_approvals;
delete from public.customer_signatures;
delete from public.service_reports;
delete from public.ticket_visits;
delete from public.ticket_time_entries;
delete from public.ticket_parts;
delete from public.ticket_attachments;
delete from public.ticket_comments;
delete from public.ticket_assignments;
delete from public.ticket_status_history;
delete from public.tickets;
delete from public.assets;
delete from public.amc_engineers;
delete from public.amc_branches;
delete from public.amc_contracts;
delete from public.employee_branches;
delete from public.employee_customers;
delete from public.employee_certifications;
delete from public.employee_skills;
delete from public.customer_users;
delete from public.notifications;
delete from public.email_logs;
delete from public.audit_logs;

-- profiles must go before branches/customers/employees: it holds the
-- foreign keys into all three.
delete from public.profiles;
delete from public.branches;
delete from public.customers;
delete from public.employees;
delete from auth.users;
delete from public.number_sequences where scope in ('ticket','service_report','amc','asset');

-- ---------------------------------------------------------------------
-- Demo password. Change DEMO_PASSWORD before running if you prefer.
-- ---------------------------------------------------------------------
create temporary table _cfg as
select 'RctDemo!2026' as demo_password;

-- ---------------------------------------------------------------------
-- Helper: create an auth user + profile in one step
-- ---------------------------------------------------------------------
create or replace function pg_temp.mk_user(
  p_email       text,
  p_name        text,
  p_role        app.user_role,
  p_phone       text default null,
  p_customer_id uuid default null,
  p_branch_id   uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_pw text;
begin
  select demo_password into v_pw from _cfg;

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
  values (v_id, p_email, crypt(v_pw, gen_salt('bf')), now(),
          jsonb_build_object('full_name', p_name));

  -- customer_id must be supplied in the same statement as the role:
  -- profiles_scope_consistent is a CHECK constraint, so it is evaluated
  -- immediately and cannot be deferred to the end of the transaction.
  insert into public.profiles
    (id, email, full_name, phone, role, customer_id, branch_id, is_active, must_change_password)
  values
    (v_id, p_email, p_name, p_phone, p_role, p_customer_id, p_branch_id, true, true);

  return v_id;
end;
$$;

-- =====================================================================
-- STAFF
-- =====================================================================
do $$
declare
  v_dept_tech uuid;
  v_dept_desk uuid;
  v_dept_mgmt uuid;
  v_pid  uuid;
  v_eid  uuid;
  r      record;
begin
  select id into v_dept_tech from public.departments where name = 'Technical Services';
  select id into v_dept_desk from public.departments where name = 'Service Desk';
  select id into v_dept_mgmt from public.departments where name = 'Management';

  for r in
    select * from (values
      ('admin@ramcomputer.ae',            'Imran Sheikh',       'super_admin',     'Head of IT Operations', 'EMP-0001', '+971 50 111 0001'),
      ('operations@ramcomputer.ae',       'Fatima Al Zaabi',    'admin',           'Systems Administrator', 'EMP-0002', '+971 50 111 0002'),
      ('management@ramcomputer.ae',       'Rajesh Menon',       'management',      'Operations Manager',    'EMP-0003', '+971 50 111 0003'),
      ('servicemanager@ramcomputer.ae',   'Nadia Haddad',       'service_manager', 'Service Delivery Manager','EMP-0004','+971 50 111 0004'),
      ('arun.kumar@ramcomputer.ae',       'Arun Kumar',         'engineer',        'Senior Network Engineer','EMP-0005', '+971 50 111 0005'),
      ('sameer.qureshi@ramcomputer.ae',   'Sameer Qureshi',     'engineer',        'Systems Engineer',      'EMP-0006', '+971 50 111 0006'),
      ('daniel.okafor@ramcomputer.ae',    'Daniel Okafor',      'engineer',        'Field Service Engineer','EMP-0007', '+971 50 111 0007'),
      ('priya.nair@ramcomputer.ae',       'Priya Nair',         'engineer',        'Security Systems Engineer','EMP-0008','+971 50 111 0008'),
      ('mohammed.tariq@ramcomputer.ae',   'Mohammed Tariq',     'engineer',        'Support Engineer',      'EMP-0009', '+971 50 111 0009'),
      ('elena.petrova@ramcomputer.ae',    'Elena Petrova',      'engineer',        'Cloud Support Engineer','EMP-0010', '+971 50 111 0010'),
      ('joseph.mathew@ramcomputer.ae',    'Joseph Mathew',      'engineer',        'Field Service Engineer','EMP-0011', '+971 50 111 0011'),
      ('hassan.ali@ramcomputer.ae',       'Hassan Ali',         'engineer',        'Junior Support Engineer','EMP-0012','+971 50 111 0012')
    ) as t(email, name, role, title, code, phone)
  loop
    v_pid := pg_temp.mk_user(r.email, r.name, r.role::app.user_role, r.phone);

    insert into public.employees
      (employee_code, profile_id, full_name, email, phone, job_title, department_id, role,
       joining_date, status, max_open_tickets)
    values
      (r.code, v_pid, r.name, r.email, r.phone, r.title,
       case r.role when 'engineer' then v_dept_tech
                   when 'service_manager' then v_dept_desk
                   else v_dept_mgmt end,
       r.role::app.user_role,
       current_date - (400 + random() * 900)::int,
       'active',
       case r.role when 'engineer' then 12 + (random() * 8)::int else 25 end)
    returning id into v_eid;

    update public.profiles set employee_id = v_eid where id = v_pid;
  end loop;
end $$;

-- Skills for engineers
insert into public.employee_skills (employee_id, skill_id, proficiency)
select e.id, s.id, 3 + (random() * 2)::int
from public.employees e
cross join lateral (
  select id from public.skills order by random() limit 4
) s
where e.role = 'engineer';

insert into public.employee_certifications (employee_id, name, issuer, issued_on, expires_on, reference_no)
select e.id, c.name, c.issuer,
       current_date - (200 + random() * 500)::int,
       current_date + (60 + random() * 700)::int,
       'CERT-' || upper(substr(md5(random()::text), 1, 8))
from public.employees e
join lateral (
  select * from (values
    ('CCNA Routing & Switching', 'Cisco'),
    ('Microsoft 365 Certified: Administrator', 'Microsoft'),
    ('Fortinet NSE 4', 'Fortinet'),
    ('CompTIA Security+', 'CompTIA'),
    ('Veeam Certified Engineer', 'Veeam')
  ) as x(name, issuer) order by random() limit 2
) c on true
where e.role = 'engineer';

-- =====================================================================
-- CUSTOMERS, BRANCHES AND CONTACTS
-- =====================================================================
do $$
declare
  v_std uuid; v_prm uuid; v_247 uuid;
  v_cid uuid; v_bid uuid; v_pid uuid;
  r record; b record;
  v_seq int := 0;
begin
  select id into v_std from public.sla_plans where code = 'STANDARD';
  select id into v_prm from public.sla_plans where code = 'PREMIUM';
  select id into v_247 from public.sla_plans where code = 'CRITICAL_24X7';

  for r in
    select * from (values
      ('CUS-0001','Gulf Horizon Trading LLC','Khalid Al Mansoori','operations@gulfhorizon.example','+971 4 335 1200','Business Bay','Dubai','AMC','CTR-2026-014'),
      ('CUS-0002','Meridian Hospitality Group','Sofia Lombardi','it@meridianhg.example','+971 4 447 8890','Al Barsha','Dubai','AMC','CTR-2026-021'),
      ('CUS-0003','Emirates Steel Fabrication','Yousef Al Rashid','support@esfab.example','+971 2 551 4400','Mussafah','Abu Dhabi','AMC','CTR-2026-008'),
      ('CUS-0004','Northline Logistics FZE','Grace Fernandes','helpdesk@northline.example','+971 6 552 3311','Hamriyah Free Zone','Sharjah','ON_CALL',null),
      ('CUS-0005','Al Waha Medical Centre','Dr. Amina Suleiman','admin@alwahamedical.example','+971 4 228 7654','Deira','Dubai','AMC','CTR-2026-033')
    ) as t(code, name, contact, email, phone, area, emirate, ctype, contract)
  loop
    v_seq := v_seq + 1;

    insert into public.customers
      (customer_code, company_name, contact_person, email, phone, address_line1, city, emirate,
       customer_type, contract_number, amc_start_date, amc_expiry_date, sla_plan_id, status,
       trade_licence_no, tax_registration_no, notes)
    values
      (r.code, r.name, r.contact, r.email, r.phone, r.area, r.emirate, r.emirate,
       r.ctype::app.customer_type, r.contract,
       case when r.ctype = 'AMC' then current_date - (200 + random()*140)::int end,
       case when r.ctype = 'AMC' then current_date + (case v_seq when 1 then 18 when 3 then 52 when 5 then 240 else 300 end) end,
       case v_seq when 3 then v_247 when 2 then v_prm when 5 then v_prm else v_std end,
       'active',
       'TL-' || (100000 + v_seq * 7919)::text,
       '1000' || lpad((v_seq * 137)::text, 11, '0'),
       null)
    returning id into v_cid;

    -- two sites each
    for b in
      select * from (values
        ('BR-01', r.name || ' - Head Office', true),
        ('BR-02', r.name || ' - ' || (array['Warehouse','Branch Office','Site Office','Clinic','Distribution Centre'])[v_seq], false)
      ) as x(code, bname, is_ho)
    loop
      insert into public.branches
        (customer_id, branch_code, branch_name, contact_person, phone, email,
         address_line1, city, emirate, latitude, longitude, working_hours, is_head_office, status)
      values
        (v_cid, b.code, b.bname, r.contact, r.phone, r.email,
         r.area, r.emirate, r.emirate,
         round((24.0 + random() * 1.6)::numeric, 6),
         round((54.3 + random() * 1.4)::numeric, 6),
         'Sun-Thu 08:00-18:00', b.is_ho, 'active')
      returning id into v_bid;

      if b.is_ho then
        -- portal admin for this customer
        v_pid := pg_temp.mk_user(
          lower(replace(split_part(r.name, ' ', 1), '.', '')) || '.admin@' ||
            split_part(r.email, '@', 2),
          r.contact, 'customer_admin', r.phone, v_cid, v_bid);

        insert into public.customer_users (customer_id, profile_id, branch_id, job_title, is_primary, can_approve_work)
        values (v_cid, v_pid, v_bid, 'IT Coordinator', true, true);
      end if;
    end loop;
  end loop;
end $$;

-- Additional customer_user (non-admin) for the first customer,
-- to demonstrate the two customer-side roles.
do $$
declare v_cid uuid; v_bid uuid; v_pid uuid;
begin
  select id into v_cid from public.customers where customer_code = 'CUS-0001';
  select id into v_bid from public.branches where customer_id = v_cid and is_head_office;

  v_pid := pg_temp.mk_user('user.gulfhorizon@gulfhorizon.example', 'Maria Santos',
                           'customer_user', '+971 4 335 1201', v_cid, v_bid);
  insert into public.customer_users (customer_id, profile_id, branch_id, job_title)
  values (v_cid, v_pid, v_bid, 'Office Administrator');
end $$;

-- Engineer coverage
insert into public.employee_customers (employee_id, customer_id, is_primary)
select e.id, c.id, row_number() over (partition by c.id order by e.employee_code) = 1
from public.employees e
join public.customers c on true
where e.role = 'engineer'
  and (('x' || substr(md5(e.id::text || c.id::text), 1, 4))::bit(16)::int % 10) < 6
on conflict do nothing;

-- Guarantee every customer has at least two covering engineers.
insert into public.employee_customers (employee_id, customer_id, is_primary)
select e.id, c.id, false
from public.customers c
cross join lateral (
  select id from public.employees
  where role = 'engineer'
    and id not in (select employee_id from public.employee_customers where customer_id = c.id)
  order by employee_code
  limit 2
) e
where (select count(*) from public.employee_customers ec where ec.customer_id = c.id) < 2
on conflict do nothing;

-- Account managers
update public.customers c
   set account_manager_id = (select id from public.employees where employee_code = 'EMP-0004');

-- =====================================================================
-- AMC CONTRACTS
-- =====================================================================
insert into public.amc_contracts
  (customer_id, contract_type, sla_plan_id, start_date, expiry_date, covered_services,
   excluded_services, visits_included, visits_consumed, contract_value, payment_terms,
   billing_frequency, notes)
select
  c.id,
  case c.customer_code
    when 'CUS-0003' then 'COMPREHENSIVE'
    when 'CUS-0002' then 'COMPREHENSIVE'
    when 'CUS-0005' then 'NON_COMPREHENSIVE'
    when 'CUS-0001' then 'COMPREHENSIVE'
    else 'LABOUR_ONLY' end,
  c.sla_plan_id,
  coalesce(c.amc_start_date, current_date - 180),
  coalesce(c.amc_expiry_date, current_date + 185),
  array['Preventive maintenance','Break-fix support','Remote support','On-site support'],
  array['Consumables','Hardware replacement beyond warranty'],
  12,
  (random() * 8)::int,
  round((18000 + random() * 60000)::numeric, 2),
  '30 days from invoice date',
  'ANNUAL',
  'Quarterly preventive maintenance visits included.'
from public.customers c;

insert into public.amc_branches (amc_contract_id, branch_id)
select m.id, b.id
from public.amc_contracts m
join public.branches b on b.customer_id = m.customer_id;

insert into public.amc_engineers (amc_contract_id, employee_id, is_primary)
select m.id, ec.employee_id, ec.is_primary
from public.amc_contracts m
join public.employee_customers ec on ec.customer_id = m.customer_id;

-- =====================================================================
-- ASSETS
-- =====================================================================
insert into public.assets
  (customer_id, branch_id, asset_type_id, name, manufacturer, model, serial_number,
   purchase_date, installation_date, warranty_expiry, ip_address, hostname,
   operating_system, location_detail, status, criticality)
select
  b.customer_id,
  b.id,
  at2.id,
  a.name,
  a.mfr,
  a.model,
  upper(substr(md5(b.id::text || a.name), 1, 12)),
  current_date - (400 + random() * 800)::int,
  current_date - (380 + random() * 700)::int,
  current_date + (random() * 500 - 100)::int,
  ('10.10.' || (1 + (random()*20)::int) || '.' || (10 + (random()*200)::int))::inet,
  lower(replace(a.name, ' ', '-')) || '-' || substr(md5(b.id::text), 1, 4),
  a.os,
  a.loc,
  'IN_SERVICE',
  a.crit
from public.branches b
join lateral (
  select * from (values
    ('Primary Domain Controller','Dell','PowerEdge R650','Windows Server 2022','Server Room - Rack A', 5, 'SERVER'),
    ('Core Network Switch','Cisco','Catalyst C9200-48P',null,'Server Room - Rack A', 5, 'SWITCH'),
    ('Perimeter Firewall','Fortinet','FortiGate 100F','FortiOS 7.4','Server Room - Rack A', 5, 'FIREWALL'),
    ('CCTV Recorder','Hikvision','DS-7732NI-K4',null,'Security Room', 4, 'NVR'),
    ('Reception Printer','HP','LaserJet Ent M507',null,'Reception', 2, 'PRINTER')
  ) as x(name, mfr, model, os, loc, crit, type_code)
  order by random() limit 3
) a on true
join public.asset_types at2 on at2.code = a.type_code;

update public.assets a
   set amc_contract_id = m.id
from public.amc_contracts m
where m.customer_id = a.customer_id;

-- =====================================================================
-- TICKETS - 50 records spread across the last five months
-- =====================================================================
do $$
declare
  i            int;
  v_customer   record;
  v_branch     uuid;
  v_category   record;
  v_sub        uuid;
  v_priority   record;
  v_engineer   record;
  v_manager    uuid;
  v_creator    uuid;
  v_created    timestamptz;
  v_ticket     uuid;
  v_status     app.ticket_status;
  v_asset      uuid;
  v_roll       int;
  v_resolved   timestamptz;
  v_subjects   text[];
  v_subject    text;
  v_report     uuid;
  v_sig        uuid;
begin
  select id into v_manager from public.employees where employee_code = 'EMP-0004';

  for i in 1..50 loop
    select c.id, c.company_name into v_customer
    from public.customers c order by random() limit 1;

    select b.id into v_branch
    from public.branches b where b.customer_id = v_customer.id order by random() limit 1;

    select cat.id, cat.code, cat.name into v_category
    from public.categories cat where cat.is_active order by random() limit 1;

    select s.id into v_sub
    from public.subcategories s where s.category_id = v_category.id order by random() limit 1;

    -- Weight the priority mix towards the middle, like real traffic.
    v_roll := (random() * 100)::int;
    select p.id, p.code into v_priority from public.priorities p
    where p.code = case
      when v_roll < 8  then 'CRITICAL'
      when v_roll < 32 then 'HIGH'
      when v_roll < 80 then 'MEDIUM'
      else 'LOW' end;

    select e.id into v_engineer
    from public.employee_customers ec
    join public.employees e on e.id = ec.employee_id
    where ec.customer_id = v_customer.id
    order by random() limit 1;

    select p.id into v_creator
    from public.profiles p
    where p.customer_id = v_customer.id
    order by random() limit 1;

    select a.id into v_asset
    from public.assets a where a.branch_id = v_branch order by random() limit 1;

    v_created := now()
      - make_interval(days => (random() * 150)::int)
      - make_interval(hours => (random() * 10)::int, mins => (random() * 59)::int);

    v_subjects := case v_category.code
      when 'NETWORK'        then array['Intermittent network drops in the finance area','No internet connectivity at the second floor','Core switch port showing errors']
      when 'SERVER'         then array['File server responding slowly','Domain controller replication warnings','Server C: drive almost full']
      when 'ENDPOINT'       then array['Laptop will not boot after update','Workstation extremely slow since Monday','Blue screen on startup']
      when 'PRINTER'        then array['Reception printer jamming repeatedly','Printer not visible on the network','Faded print output on all documents']
      when 'CCTV'           then array['Two cameras offline in the warehouse','NVR not recording overnight','Cannot view cameras remotely']
      when 'ACCESS_CONTROL' then array['Main entrance door not releasing','Card reader unresponsive','New staff cards need enrolment']
      when 'WIFI'           then array['Weak Wi-Fi signal in meeting rooms','Guest Wi-Fi not issuing addresses','Access point offline in the lobby']
      when 'FIREWALL'       then array['VPN disconnecting every few minutes','Legitimate website blocked by filter','Firewall licence renewal warning']
      when 'M365'           then array['Teams meetings dropping audio','SharePoint sync failing on three PCs','Licence needed for a new joiner']
      when 'EMAIL'          then array['Not receiving external email since morning','Outbound mail queued and not sending','Phishing email reported by staff']
      when 'SOFTWARE'       then array['Accounting software crashes on export','Licence activation required','Application update failing to install']
      when 'HARDWARE'       then array['Hard disk failure warning on workstation','UPS battery replacement required','Monitor flickering intermittently']
      when 'PABX'           then array['No dial tone on reception extension','Voicemail not recording messages','New extension setup required']
      when 'BACKUP'         then array['Nightly backup job failing','Restore request for deleted folder','Backup storage nearly full']
      when 'CYBERSECURITY'  then array['Suspicious login alert on a mailbox','Endpoint protection reporting a threat','Monthly patching review required']
      else                       array['General IT support request','Site survey requested','Equipment relocation required']
    end;
    v_subject := v_subjects[1 + (random() * (array_length(v_subjects,1) - 1))::int];

    -- Status distribution weighted towards completed work.
    v_roll := (random() * 100)::int;
    v_status := case
      when v_roll < 44 then 'CLOSED'
      when v_roll < 58 then 'RESOLVED'
      when v_roll < 70 then 'IN_PROGRESS'
      when v_roll < 78 then 'ON_SITE'
      when v_roll < 84 then 'ASSIGNED'
      when v_roll < 89 then 'ACCEPTED'
      when v_roll < 93 then 'PENDING_PARTS'
      when v_roll < 96 then 'ON_HOLD'
      when v_roll < 98 then 'NEW'
      else 'CANCELLED' end::app.ticket_status;

    v_resolved := v_created + make_interval(hours => (2 + random() * 60)::int);

    insert into public.tickets (
      customer_id, branch_id, asset_id, category_id, subcategory_id, priority_id,
      subject, description, status, created_by, assigned_engineer_id, service_manager_id,
      contact_person, contact_phone, created_at,
      assigned_at, accepted_at, first_response_at, work_started_at, on_site_at,
      resolved_at, closed_at,
      diagnosis, work_performed, resolution_summary, engineer_remarks,
      cancellation_reason, is_billable
    )
    values (
      v_customer.id, v_branch, v_asset, v_category.id, v_sub, v_priority.id,
      v_subject,
      v_subject || '. Reported by the site contact. ' ||
        'The issue was first noticed earlier today and is affecting normal operations at the site. ' ||
        'Please attend and advise.',
      v_status,
      v_creator,
      case when v_status = 'NEW' then null else v_engineer.id end,
      v_manager,
      (select contact_person from public.branches where id = v_branch),
      (select phone from public.branches where id = v_branch),
      v_created,
      case when v_status = 'NEW' then null else v_created + interval '8 minutes' end,
      case when v_status in ('NEW','ASSIGNED','CANCELLED') then null else v_created + interval '22 minutes' end,
      case when v_status in ('NEW','ASSIGNED','CANCELLED') then null else v_created + interval '22 minutes' end,
      case when v_status in ('NEW','ASSIGNED','ACCEPTED','CANCELLED') then null else v_created + interval '1 hour' end,
      case when v_status in ('ON_SITE','RESOLVED','CLOSED') then v_created + interval '2 hours' end,
      case when v_status in ('RESOLVED','CLOSED') then v_resolved end,
      case when v_status = 'CLOSED' then v_resolved + interval '3 hours' end,
      case when v_status in ('RESOLVED','CLOSED','IN_PROGRESS','ON_SITE')
           then 'On inspection the fault was traced to ' ||
                (array['a failed component','a misconfiguration applied during recent changes',
                       'a firmware defect','physical damage to the cabling',
                       'resource exhaustion on the device'])[1 + (random()*4)::int] || '.' end,
      case when v_status in ('RESOLVED','CLOSED')
           then 'Replaced/reconfigured the affected item, verified full functionality with the site contact and confirmed normal operation before leaving site.' end,
      case when v_status in ('RESOLVED','CLOSED')
           then 'Issue resolved and service restored. Verified with the site contact before departure.' end,
      case when v_status in ('RESOLVED','CLOSED')
           then 'Recommend scheduling preventive maintenance at the next quarterly visit.' end,
      case when v_status = 'CANCELLED' then 'Duplicate of another ticket raised for the same fault.' end,
      random() < 0.3
    )
    returning id into v_ticket;

    -- Comments
    insert into public.ticket_comments (ticket_id, author_id, author_name, author_role, body, is_internal, created_at)
    select v_ticket, v_creator, p.full_name, p.role,
           'Please note the site is accessible between 08:00 and 17:00. Ask for the reception desk on arrival.',
           false, v_created + interval '15 minutes'
    from public.profiles p where p.id = v_creator;

    if v_status not in ('NEW','ASSIGNED') then
      insert into public.ticket_comments (ticket_id, author_id, author_name, author_role, body, is_internal, created_at)
      select v_ticket, e.profile_id, e.full_name, 'engineer',
             'Attending site now. Will update once the initial diagnosis is complete.',
             false, v_created + interval '45 minutes'
      from public.employees e where e.id = v_engineer.id;

      insert into public.ticket_comments (ticket_id, author_id, author_name, author_role, body, is_internal, created_at)
      select v_ticket, e.profile_id, e.full_name, 'engineer',
             'Internal note: spare unit taken from the Dubai stores. Update stock records after closure.',
             true, v_created + interval '90 minutes'
      from public.employees e where e.id = v_engineer.id;
    end if;

    -- Site visit checkpoints
    if v_status in ('ON_SITE','RESOLVED','CLOSED') then
      insert into public.ticket_visits (ticket_id, engineer_id, stage, occurred_at, latitude, longitude)
      values
        (v_ticket, v_engineer.id, 'TRAVEL_STARTED', v_created + interval '70 minutes',
         round((24.0 + random()*1.6)::numeric, 6), round((54.3 + random()*1.4)::numeric, 6)),
        (v_ticket, v_engineer.id, 'ARRIVED',        v_created + interval '2 hours',
         round((24.0 + random()*1.6)::numeric, 6), round((54.3 + random()*1.4)::numeric, 6)),
        (v_ticket, v_engineer.id, 'WORK_STARTED',   v_created + interval '2 hours 10 minutes', null, null);

      if v_status in ('RESOLVED','CLOSED') then
        insert into public.ticket_visits (ticket_id, engineer_id, stage, occurred_at)
        values (v_ticket, v_engineer.id, 'WORK_COMPLETED', v_resolved),
               (v_ticket, v_engineer.id, 'DEPARTED',       v_resolved + interval '20 minutes');
      end if;
    end if;

    -- Labour
    if v_status in ('RESOLVED','CLOSED') then
      insert into public.ticket_time_entries (ticket_id, engineer_id, started_at, ended_at, activity, notes)
      values (v_ticket, v_engineer.id, v_created + interval '2 hours', v_resolved, 'onsite',
              'On-site diagnosis and repair.');
    end if;

    -- Parts on roughly a third of completed tickets
    if v_status in ('RESOLVED','CLOSED') and random() < 0.35 then
      insert into public.ticket_parts
        (ticket_id, part_name, serial_number, quantity, unit, unit_cost, is_replacement, remarks)
      values (
        v_ticket,
        (array['Cat6 patch cable 3m','SFP+ transceiver module','2TB enterprise hard disk',
               'UPS replacement battery','48-port patch panel','Toner cartridge',
               'PoE injector','Network interface card'])[1 + (random()*7)::int],
        upper(substr(md5(v_ticket::text), 1, 10)),
        1 + (random()*2)::int, 'pcs',
        round((45 + random() * 900)::numeric, 2), true,
        'Faulty unit replaced and returned to stores.');
    end if;

    -- Service report + signature for closed tickets
    if v_status = 'CLOSED' then
      insert into public.customer_signatures
        (ticket_id, signer_type, signer_name, signer_title, storage_path, content_hash, signed_at)
      values
        (v_ticket, 'customer',
         (select contact_person from public.branches where id = v_branch),
         'Site Contact',
         'signatures/' || v_ticket || '/' || gen_random_uuid() || '.png',
         encode(sha256(v_ticket::text::bytea), 'hex'),
         v_resolved + interval '10 minutes')
      returning id into v_sig;

      insert into public.service_reports (
        ticket_id, customer_id, branch_id, engineer_id,
        complaint_summary, diagnosis, work_performed, engineer_remarks,
        service_started_at, arrival_at, completion_at, total_minutes,
        customer_signature_id, customer_signed_name, engineer_signed_name,
        final_status, is_approved, approved_at, pdf_generated_at, pdf_version,
        storage_path, snapshot
      )
      select
        v_ticket, v_customer.id, v_branch, v_engineer.id,
        t.subject, t.diagnosis, t.work_performed, t.engineer_remarks,
        t.work_started_at, t.on_site_at, t.resolved_at,
        greatest(30, (extract(epoch from (t.resolved_at - t.on_site_at)) / 60)::int),
        v_sig,
        (select contact_person from public.branches where id = v_branch),
        (select full_name from public.employees where id = v_engineer.id),
        'CLOSED', true, t.closed_at, t.closed_at, 1,
        'service-reports/' || v_ticket || '/report.pdf',
        jsonb_build_object(
          'customer_name', v_customer.company_name,
          'ticket_number', t.ticket_number,
          'category', v_category.name,
          'priority', v_priority.code)
      from public.tickets t where t.id = v_ticket
      returning id into v_report;

      -- Feedback on most closed tickets
      if random() < 0.75 then
        insert into public.customer_feedback (
          ticket_id, customer_id, engineer_id, submitted_by,
          issue_resolved, overall_rating, engineer_rating, service_rating, response_rating,
          comments, requested_at, submitted_at)
        values (
          v_ticket, v_customer.id, v_engineer.id, v_creator,
          true,
          case when random() < 0.72 then 5 when random() < 0.9 then 4 when random() < 0.97 then 3 else 2 end,
          case when random() < 0.8 then 5 else 4 end,
          case when random() < 0.75 then 5 else 4 end,
          case when random() < 0.7 then 5 else 4 end,
          (array['Very prompt and professional service, thank you.',
                 'Engineer explained the fault clearly and fixed it quickly.',
                 'Good service overall, response could have been slightly faster.',
                 'Resolved on the first visit. Much appreciated.',
                 null])[1 + (random()*4)::int],
          v_resolved, v_resolved + interval '1 day');
      end if;
    end if;
  end loop;
end $$;

-- Cancelled tickets keep an explicit reason (constraint already enforces it).
-- Recompute AMC states from today's date.
select app.refresh_amc_statuses();

-- Recompute SLA states across the seeded population.
select * from app.sweep_sla();

commit;

-- ---------------------------------------------------------------------
-- Summary
-- ---------------------------------------------------------------------
select 'customers'       as entity, count(*) from public.customers
union all select 'branches',         count(*) from public.branches
union all select 'employees',        count(*) from public.employees
union all select 'profiles',         count(*) from public.profiles
union all select 'tickets',          count(*) from public.tickets
union all select 'timeline events',  count(*) from public.ticket_status_history
union all select 'comments',         count(*) from public.ticket_comments
union all select 'assets',           count(*) from public.assets
union all select 'amc contracts',    count(*) from public.amc_contracts
union all select 'service reports',  count(*) from public.service_reports
union all select 'signatures',       count(*) from public.customer_signatures
union all select 'feedback',         count(*) from public.customer_feedback
union all select 'notifications',    count(*) from public.notifications;

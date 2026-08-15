-- =====================================================================
-- RCT APPLICATION | Migration 0016 - Baseline configuration
--
-- This is platform configuration, not demo data: roles, permissions,
-- priorities, the default service catalogue, SLA plans, the UAE business
-- calendar, email templates and system settings. It is required for a
-- production deployment. Demo records live in supabase/seed/seed.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------
insert into public.roles (code, name, description, rank, is_staff) values
  ('super_admin',    'Super Administrator', 'Unrestricted platform control including role management.', 10, true),
  ('admin',          'Administrator',       'System configuration, users, settings and audit access.',  20, true),
  ('management',     'Management',          'Company-wide operational visibility, analytics and reporting.', 30, true),
  ('service_manager','Service Manager',     'Assigns engineers, monitors SLA and approves service delivery.', 40, true),
  ('engineer',       'Engineer',            'Delivers service on assigned tickets.',                     50, true),
  ('customer_admin', 'Customer Administrator','Manages their company''s contacts and sees all company tickets.', 60, false),
  ('customer_user',  'Customer User',       'Raises and tracks tickets for their company.',              70, false)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      rank = excluded.rank,
      is_staff = excluded.is_staff;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
insert into public.permissions (code, resource, action, description) values
  ('ticket.view',        'ticket',   'view',    'View tickets within scope'),
  ('ticket.create',      'ticket',   'create',  'Raise a new ticket'),
  ('ticket.update',      'ticket',   'update',  'Edit ticket fields'),
  ('ticket.assign',      'ticket',   'assign',  'Assign or reassign an engineer'),
  ('ticket.close',       'ticket',   'close',   'Close a resolved ticket'),
  ('ticket.reopen',      'ticket',   'reopen',  'Reopen a resolved or closed ticket'),
  ('ticket.delete',      'ticket',   'delete',  'Permanently delete a ticket'),
  ('customer.view',      'customer', 'view',    'View customer records'),
  ('customer.manage',    'customer', 'manage',  'Create and edit customers and branches'),
  ('employee.view',      'employee', 'view',    'View employee records'),
  ('employee.manage',    'employee', 'manage',  'Create and edit employees'),
  ('amc.view',           'amc',      'view',    'View AMC contracts'),
  ('amc.manage',         'amc',      'manage',  'Create and edit AMC contracts'),
  ('asset.view',         'asset',    'view',    'View the asset register'),
  ('asset.manage',       'asset',    'manage',  'Create and edit assets'),
  ('report.view',        'report',   'view',    'View analytics and reports'),
  ('report.export',      'report',   'export',  'Export reports to PDF, Excel or CSV'),
  ('settings.view',      'settings', 'view',    'View system settings'),
  ('settings.manage',    'settings', 'manage',  'Change system settings'),
  ('audit.view',         'audit',    'view',    'Read the audit log'),
  ('user.manage',        'user',     'manage',  'Create users and assign roles')
on conflict (code) do nothing;

-- Role -> permission matrix
do $$
declare
  v_role   record;
  v_codes  text[];
begin
  for v_role in select id, code from public.roles loop
    v_codes := case v_role.code
      when 'super_admin' then array(select code from public.permissions)
      when 'admin'       then array(select code from public.permissions where code <> 'ticket.delete')
      when 'management'  then array[
        'ticket.view','ticket.create','ticket.update','ticket.assign','ticket.close','ticket.reopen',
        'customer.view','customer.manage','employee.view','amc.view','amc.manage',
        'asset.view','asset.manage','report.view','report.export','audit.view','settings.view']
      when 'service_manager' then array[
        'ticket.view','ticket.create','ticket.update','ticket.assign','ticket.close','ticket.reopen',
        'customer.view','employee.view','amc.view','asset.view','asset.manage',
        'report.view','report.export']
      when 'engineer' then array[
        'ticket.view','ticket.create','ticket.update','ticket.close',
        'customer.view','asset.view','asset.manage']
      when 'customer_admin' then array[
        'ticket.view','ticket.create','ticket.reopen','customer.view','asset.view','report.view']
      when 'customer_user' then array[
        'ticket.view','ticket.create','ticket.reopen','asset.view']
      else array[]::text[]
    end;

    delete from public.role_permissions where role_id = v_role.id;

    insert into public.role_permissions (role_id, permission_id)
    select v_role.id, p.id from public.permissions p where p.code = any (v_codes);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Priorities
-- ---------------------------------------------------------------------
insert into public.priorities (code, name, description, severity, colour, is_default) values
  ('LOW',      'Low',      'Minor issue with no material impact on operations.',        1, '#10b981', false),
  ('MEDIUM',   'Medium',   'Noticeable impact, a workaround is available.',             2, '#f59e0b', true),
  ('HIGH',     'High',     'Significant impact on a department or key user.',           3, '#f97316', false),
  ('CRITICAL', 'Critical', 'Business-stopping outage affecting the whole site.',        4, '#ef4444', false)
on conflict (code) do update
  set name = excluded.name, description = excluded.description,
      severity = excluded.severity, colour = excluded.colour;

-- ---------------------------------------------------------------------
-- Service catalogue
-- ---------------------------------------------------------------------
insert into public.categories (code, name, description, icon, colour, sort_order) values
  ('NETWORK',        'Network',            'Switches, routers, cabling, connectivity and VLANs.', 'network',      '#3b82f6', 10),
  ('SERVER',         'Server',             'Physical and virtual servers, storage and hypervisors.','server',      '#6366f1', 20),
  ('ENDPOINT',       'Desktop / Laptop',   'Workstations, laptops, peripherals and OS issues.',   'laptop',        '#0ea5e9', 30),
  ('PRINTER',        'Printer',            'Printers, scanners, copiers and print queues.',       'printer',       '#8b5cf6', 40),
  ('CCTV',           'CCTV',               'Cameras, NVR/DVR, recording and remote viewing.',     'cctv',          '#ec4899', 50),
  ('ACCESS_CONTROL', 'Access Control',     'Door controllers, readers, biometrics and barriers.', 'door',          '#f43f5e', 60),
  ('WIFI',           'Wi-Fi',              'Access points, controllers, coverage and roaming.',   'wifi',          '#14b8a6', 70),
  ('FIREWALL',       'Firewall',           'Perimeter security, VPN, content filtering and NAT.', 'shield',        '#ef4444', 80),
  ('M365',           'Microsoft 365',      'Exchange Online, Teams, SharePoint and OneDrive.',    'cloud',         '#2563eb', 90),
  ('EMAIL',          'Email',              'Mail flow, spam, mailboxes and distribution lists.',  'mail',          '#0891b2', 100),
  ('SOFTWARE',       'Software',           'Applications, licensing, updates and installation.',  'app-window',    '#7c3aed', 110),
  ('HARDWARE',       'Hardware',           'Component failure, replacement and warranty claims.', 'cpu',           '#64748b', 120),
  ('PABX',           'Telephone / PABX',   'IP telephony, extensions, trunks and voicemail.',     'phone',         '#059669', 130),
  ('BACKUP',         'Backup',             'Backup jobs, restores, retention and disaster recovery.','database',   '#d97706', 140),
  ('CYBERSECURITY',  'Cybersecurity',      'Endpoint protection, incidents, patching and hardening.','shield-alert','#dc2626', 150),
  ('OTHER',          'Other',              'Anything that does not fit an existing category.',    'help-circle',   '#94a3b8', 999)
on conflict (code) do update
  set name = excluded.name, description = excluded.description,
      icon = excluded.icon, colour = excluded.colour, sort_order = excluded.sort_order;

insert into public.subcategories (category_id, code, name, sort_order)
select c.id, s.code, s.name, s.sort_order
from public.categories c
join (values
  ('NETWORK','NO_CONNECTIVITY','No connectivity',10),
  ('NETWORK','SLOW_NETWORK','Slow network',20),
  ('NETWORK','SWITCH_FAULT','Switch fault',30),
  ('NETWORK','CABLING','Cabling / patching',40),
  ('SERVER','SERVER_DOWN','Server down',10),
  ('SERVER','PERFORMANCE','Performance degradation',20),
  ('SERVER','STORAGE_FULL','Storage capacity',30),
  ('SERVER','OS_PATCHING','OS / patching',40),
  ('ENDPOINT','NO_BOOT','Will not power on / boot',10),
  ('ENDPOINT','SLOW_PC','Slow performance',20),
  ('ENDPOINT','OS_ISSUE','Operating system issue',30),
  ('ENDPOINT','PERIPHERAL','Peripheral / accessory',40),
  ('PRINTER','PAPER_JAM','Paper jam',10),
  ('PRINTER','PRINT_QUALITY','Print quality',20),
  ('PRINTER','NOT_PRINTING','Not printing',30),
  ('PRINTER','TONER','Toner / consumables',40),
  ('CCTV','CAMERA_OFFLINE','Camera offline',10),
  ('CCTV','NO_RECORDING','Not recording',20),
  ('CCTV','REMOTE_VIEW','Remote viewing',30),
  ('ACCESS_CONTROL','DOOR_NOT_OPENING','Door not opening',10),
  ('ACCESS_CONTROL','READER_FAULT','Reader fault',20),
  ('ACCESS_CONTROL','USER_ENROLMENT','User enrolment',30),
  ('WIFI','WEAK_SIGNAL','Weak signal / coverage',10),
  ('WIFI','AP_DOWN','Access point down',20),
  ('WIFI','GUEST_ACCESS','Guest access',30),
  ('FIREWALL','VPN_ISSUE','VPN issue',10),
  ('FIREWALL','BLOCKED_SITE','Blocked site / policy',20),
  ('FIREWALL','FIRMWARE','Firmware / licensing',30),
  ('M365','LICENCE','Licence assignment',10),
  ('M365','TEAMS','Teams',20),
  ('M365','SHAREPOINT','SharePoint / OneDrive',30),
  ('EMAIL','NOT_RECEIVING','Not receiving mail',10),
  ('EMAIL','NOT_SENDING','Not sending mail',20),
  ('EMAIL','SPAM','Spam / phishing',30),
  ('EMAIL','MAILBOX_FULL','Mailbox full',40),
  ('SOFTWARE','INSTALLATION','Installation request',10),
  ('SOFTWARE','LICENSING','Licensing',20),
  ('SOFTWARE','ERROR','Application error',30),
  ('HARDWARE','FAILURE','Component failure',10),
  ('HARDWARE','REPLACEMENT','Replacement required',20),
  ('HARDWARE','WARRANTY','Warranty claim',30),
  ('PABX','NO_DIAL_TONE','No dial tone',10),
  ('PABX','EXTENSION','Extension configuration',20),
  ('PABX','VOICEMAIL','Voicemail',30),
  ('BACKUP','JOB_FAILED','Backup job failed',10),
  ('BACKUP','RESTORE','Restore request',20),
  ('BACKUP','CAPACITY','Capacity / retention',30),
  ('CYBERSECURITY','MALWARE','Malware / ransomware',10),
  ('CYBERSECURITY','PHISHING','Phishing report',20),
  ('CYBERSECURITY','PATCHING','Vulnerability / patching',30),
  ('OTHER','GENERAL','General request',10)
) as s(cat, code, name, sort_order) on s.cat = c.code
on conflict (category_id, code) do nothing;

-- Sensible default priority per category
update public.categories c
   set default_priority_id = p.id
from public.priorities p
where p.code = case c.code
  when 'SERVER'        then 'HIGH'
  when 'NETWORK'       then 'HIGH'
  when 'FIREWALL'      then 'HIGH'
  when 'CYBERSECURITY' then 'CRITICAL'
  when 'BACKUP'        then 'HIGH'
  else 'MEDIUM'
end
and c.default_priority_id is null;

-- ---------------------------------------------------------------------
-- SLA plans
-- ---------------------------------------------------------------------
insert into public.sla_plans (code, name, description, is_24x7, pause_on_hold, at_risk_threshold, is_default) values
  ('STANDARD', 'Standard Support',  'Sunday to Thursday, 08:00-18:00 Gulf Standard Time.', false, true, 80, true),
  ('PREMIUM',  'Premium Support',   'Extended cover Saturday to Thursday, 08:00-20:00.',   false, true, 75, false),
  ('CRITICAL_24X7', 'Critical 24x7','Round-the-clock cover for business-critical sites.',  true,  false, 70, false)
on conflict (code) do update
  set name = excluded.name, description = excluded.description,
      is_24x7 = excluded.is_24x7, pause_on_hold = excluded.pause_on_hold,
      at_risk_threshold = excluded.at_risk_threshold;

-- SLA targets. The spec's defaults are applied to the Standard plan;
-- Premium and 24x7 tighten them.
insert into public.sla_rules (sla_plan_id, priority_id, response_minutes, resolution_minutes, escalation_1_minutes, escalation_2_minutes)
select sp.id, p.id, r.response, r.resolution, r.esc1, r.esc2
from (values
  ('STANDARD','CRITICAL',  30,  240,  60,  120),
  ('STANDARD','HIGH',      60,  480, 120,  240),
  ('STANDARD','MEDIUM',   240, 1440, 480,  720),
  ('STANDARD','LOW',      480, 2880, 960, 1440),

  ('PREMIUM','CRITICAL',   15,  180,  30,   60),
  ('PREMIUM','HIGH',       30,  360,  60,  120),
  ('PREMIUM','MEDIUM',    120,  720, 240,  480),
  ('PREMIUM','LOW',       240, 1440, 480,  960),

  ('CRITICAL_24X7','CRITICAL', 15,  120,  30,   60),
  ('CRITICAL_24X7','HIGH',     30,  240,  60,  120),
  ('CRITICAL_24X7','MEDIUM',   60,  480, 120,  240),
  ('CRITICAL_24X7','LOW',     240,  960, 480,  720)
) as r(plan, priority, response, resolution, esc1, esc2)
join public.sla_plans  sp on sp.code = r.plan
join public.priorities p  on p.code  = r.priority
on conflict (sla_plan_id, priority_id) do update
  set response_minutes   = excluded.response_minutes,
      resolution_minutes = excluded.resolution_minutes;

-- ---------------------------------------------------------------------
-- UAE business calendar
-- Standard: Sunday-Thursday 08:00-18:00
-- Premium:  Saturday-Thursday 08:00-20:00
-- ISO day of week: 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat 7=Sun
-- ---------------------------------------------------------------------
insert into public.business_hours (sla_plan_id, day_of_week, opens_at, closes_at, is_working_day)
select sp.id, d.dow, d.opens, d.closes, d.working
from (values
  ('STANDARD', 7, time '08:00', time '18:00', true),   -- Sunday
  ('STANDARD', 1, time '08:00', time '18:00', true),
  ('STANDARD', 2, time '08:00', time '18:00', true),
  ('STANDARD', 3, time '08:00', time '18:00', true),
  ('STANDARD', 4, time '08:00', time '18:00', true),   -- Thursday
  ('STANDARD', 5, time '08:00', time '18:00', false),  -- Friday
  ('STANDARD', 6, time '08:00', time '18:00', false),  -- Saturday

  ('PREMIUM', 7, time '08:00', time '20:00', true),
  ('PREMIUM', 1, time '08:00', time '20:00', true),
  ('PREMIUM', 2, time '08:00', time '20:00', true),
  ('PREMIUM', 3, time '08:00', time '20:00', true),
  ('PREMIUM', 4, time '08:00', time '20:00', true),
  ('PREMIUM', 5, time '08:00', time '20:00', false),
  ('PREMIUM', 6, time '09:00', time '17:00', true)
) as d(plan, dow, opens, closes, working)
join public.sla_plans sp on sp.code = d.plan
on conflict (sla_plan_id, day_of_week) do update
  set opens_at = excluded.opens_at,
      closes_at = excluded.closes_at,
      is_working_day = excluded.is_working_day;

-- Fixed-date UAE public holidays. Islamic-calendar holidays move each
-- year and are added by the administrator from Settings > Holidays.
insert into public.holidays (sla_plan_id, holiday_date, name, is_recurring)
select sp.id, h.d, h.n, true
from (values
  (date '2026-01-01', 'New Year''s Day'),
  (date '2026-12-01', 'Commemoration Day'),
  (date '2026-12-02', 'UAE National Day'),
  (date '2026-12-03', 'UAE National Day Holiday')
) as h(d, n)
cross join public.sla_plans sp
on conflict (sla_plan_id, holiday_date) do nothing;

-- ---------------------------------------------------------------------
-- System settings
-- ---------------------------------------------------------------------
insert into public.system_settings (key, value, category, label, description, is_secret) values
  ('company_name',        '"Ram Computer Technology LLC"'::jsonb, 'company', 'Company name', 'Printed on service reports and emails.', false),
  ('company_short_name',  '"RCT"'::jsonb,                          'company', 'Short name', null, false),
  ('application_name',    '"RCT Application"'::jsonb,              'company', 'Application name', null, false),
  ('company_address',     '"Dubai, United Arab Emirates"'::jsonb,  'company', 'Registered address', null, false),
  ('company_phone',       '""'::jsonb,                             'company', 'Telephone', null, false),
  ('company_email',       '""'::jsonb,                             'company', 'Email', null, false),
  ('company_website',     '""'::jsonb,                             'company', 'Website', null, false),
  ('company_trn',         '""'::jsonb,                             'company', 'Tax registration number', 'Shown on service reports where applicable.', false),
  ('company_logo_path',   '"company/logo.png"'::jsonb,             'company', 'Logo path', 'Object path inside the private company storage bucket.', false),
  ('report_footer',       '"Ram Computer Technology LLC"'::jsonb,  'company', 'Service report footer', null, false),

  ('ticket_prefix',       '"TKT"'::jsonb,        'numbering', 'Ticket prefix', 'Produces TKT-2026-000001.', false),
  ('ticket_number_width', '"6"'::jsonb,          'numbering', 'Ticket number width', null, false),
  ('report_prefix',       '"SR"'::jsonb,         'numbering', 'Service report prefix', 'Produces SR-2026-000001.', false),
  ('report_number_width', '"6"'::jsonb,          'numbering', 'Service report number width', null, false),

  ('timezone',            '"Asia/Dubai"'::jsonb, 'regional', 'Timezone', null, false),
  ('date_format',         '"dd-MMM-yyyy"'::jsonb,'regional', 'Date format', null, false),
  ('time_format',         '"HH:mm"'::jsonb,      'regional', 'Time format', null, false),
  ('currency',            '"AED"'::jsonb,        'regional', 'Currency', null, false),
  ('locale',              '"en-AE"'::jsonb,      'regional', 'Locale', null, false),

  ('reopen_window_days',        '"14"'::jsonb,   'workflow', 'Reopen window (days)', 'How long a customer may reopen a closed ticket.', false),
  ('require_signature_on_close','"false"'::jsonb,'workflow', 'Require customer signature to close', null, false),
  ('auto_email_on_close',       '"true"'::jsonb, 'workflow', 'Email the service report on closure', null, false),
  ('feedback_request_on_resolve','"true"'::jsonb,'workflow', 'Request feedback when resolved', null, false),
  ('amc_warning_days',          '"90"'::jsonb,   'workflow', 'AMC expiry warning window (days)', null, false),

  ('smtp_host',      '""'::jsonb,     'email', 'SMTP host', null, false),
  ('smtp_port',      '"587"'::jsonb,  'email', 'SMTP port', null, false),
  ('smtp_secure',    '"tls"'::jsonb,  'email', 'Encryption', 'none, tls or ssl.', false),
  ('smtp_username',  '""'::jsonb,     'email', 'SMTP username', null, false),
  ('smtp_password',  '""'::jsonb,     'email', 'SMTP password', 'Write-only. Never returned to the browser.', true),
  ('email_provider', '"smtp"'::jsonb, 'email', 'Provider', 'smtp or resend.', false),
  ('resend_api_key', '""'::jsonb,     'email', 'Resend API key', 'Write-only. Never returned to the browser.', true),
  ('email_from',     '""'::jsonb,     'email', 'From address', null, false),
  ('email_from_name','"RCT Service Desk"'::jsonb, 'email', 'From name', null, false),
  ('email_reply_to', '""'::jsonb,     'email', 'Reply-to address', null, false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Asset types
-- ---------------------------------------------------------------------
insert into public.asset_types (code, name, icon) values
  ('SERVER','Server','server'),
  ('DESKTOP','Desktop','monitor'),
  ('LAPTOP','Laptop','laptop'),
  ('PRINTER','Printer','printer'),
  ('SWITCH','Network Switch','network'),
  ('ROUTER','Router','router'),
  ('FIREWALL','Firewall','shield'),
  ('ACCESS_POINT','Wireless Access Point','wifi'),
  ('NVR','CCTV Recorder','cctv'),
  ('CAMERA','CCTV Camera','camera'),
  ('UPS','UPS','battery'),
  ('PABX','PABX System','phone'),
  ('NAS','Storage / NAS','hard-drive'),
  ('OTHER','Other','box')
on conflict (code) do nothing;

insert into public.departments (name, description) values
  ('Technical Services', 'Field and remote engineering'),
  ('Service Desk',       'First line support and dispatch'),
  ('Management',         'Operations and account management'),
  ('Administration',     'Finance, HR and administration')
on conflict (name) do nothing;

insert into public.skills (name, category) values
  ('Windows Server','Server'), ('Linux Administration','Server'),
  ('VMware / Hyper-V','Server'), ('Active Directory','Server'),
  ('Cisco Networking','Network'), ('Ubiquiti / UniFi','Network'),
  ('Fortinet Firewall','Security'), ('Sophos Firewall','Security'),
  ('Microsoft 365','Cloud'), ('Azure','Cloud'),
  ('Hikvision CCTV','CCTV'), ('Dahua CCTV','CCTV'),
  ('Access Control','Security'), ('Structured Cabling','Network'),
  ('Veeam Backup','Backup'), ('Endpoint Security','Security'),
  ('IP Telephony','Telephony'), ('Printer Maintenance','Hardware')
on conflict (name) do nothing;

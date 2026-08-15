-- =====================================================================
-- RCT APPLICATION | Migration 0017 - Default email templates
--
-- Bodies use {{variable}} placeholders resolved by the application's
-- renderer (apps/web/src/lib/email/render.ts). Administrators may edit
-- every field from Settings > Email Templates.
-- =====================================================================

do $$
declare
  v_head text;
  v_foot text;
begin
  -- Shared chrome, inlined into each template so the rendered mail is a
  -- single self-contained document that survives any mail client.
  v_head := '<!doctype html><html><head><meta charset="utf-8">'
    || '<meta name="viewport" content="width=device-width,initial-scale=1">'
    || '</head><body style="margin:0;padding:0;background:#f1f5f9;'
    || 'font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,Helvetica,Arial,sans-serif;">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 12px;">'
    || '<tr><td align="center">'
    || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.12);">'
    || '<tr><td style="background:#0f172a;padding:24px 28px;">'
    || '<div style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:-.3px;">{{company_name}}</div>'
    || '<div style="color:#94a3b8;font-size:12px;margin-top:3px;letter-spacing:.09em;text-transform:uppercase;">RCT Service Management</div>'
    || '</td></tr><tr><td style="padding:28px;color:#0f172a;font-size:14px;line-height:1.65;">';

  v_foot := '</td></tr>'
    || '<tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 28px;color:#64748b;font-size:11px;line-height:1.6;">'
    || '{{company_name}}<br>'
    || 'This message was sent automatically by the RCT Application service desk. '
    || 'Please do not reply directly to this address.'
    || '</td></tr></table></td></tr></table></body></html>';

  insert into public.email_templates
    (code, name, description, subject, body_html, body_text, variables,
     send_to_customer, send_to_engineer, send_to_management, attach_report)
  values

  ('ticket_created', 'Ticket Created',
   'Sent to the customer contact as soon as a ticket is registered.',
   '[{{ticket_number}}] Complaint registered - {{subject}}',
   v_head
     || '<p style="margin:0 0 14px;">Dear {{customer_name}},</p>'
     || '<p style="margin:0 0 18px;">Your service request has been registered. Our team is reviewing it now and an engineer will be assigned shortly.</p>'
     || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 18px;">'
     || '<tr><td style="padding:16px 18px;">'
     || '<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;">Ticket number</div>'
     || '<div style="font-size:22px;font-weight:700;color:#0f172a;margin:3px 0 14px;">{{ticket_number}}</div>'
     || '<div style="font-size:13px;color:#334155;"><strong>Subject:</strong> {{subject}}<br>'
     || '<strong>Category:</strong> {{category}}<br>'
     || '<strong>Priority:</strong> {{priority}}<br>'
     || '<strong>Logged:</strong> {{created_date}}<br>'
     || '<strong>Target resolution:</strong> {{resolution_due}}</div>'
     || '</td></tr></table>'
     || '<p style="margin:0 0 20px;">You can follow progress at any time from the RCT customer portal.</p>'
     || '<a href="{{ticket_url}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Track this ticket</a>'
     || v_foot,
   E'Dear {{customer_name}},\n\nYour service request has been registered.\n\nTicket: {{ticket_number}}\nSubject: {{subject}}\nCategory: {{category}}\nPriority: {{priority}}\nLogged: {{created_date}}\nTarget resolution: {{resolution_due}}\n\nTrack it here: {{ticket_url}}\n\n{{company_name}}',
   array['company_name','customer_name','ticket_number','subject','category','priority','created_date','resolution_due','ticket_url'],
   true, false, true, false),

  ('ticket_assigned', 'Ticket Assigned',
   'Sent to the engineer when a ticket is assigned to them.',
   '[{{ticket_number}}] Assigned to you - {{priority}} priority',
   v_head
     || '<p style="margin:0 0 14px;">Hello {{engineer_name}},</p>'
     || '<p style="margin:0 0 18px;">Ticket <strong>{{ticket_number}}</strong> has been assigned to you.</p>'
     || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 18px;">'
     || '<tr><td style="padding:16px 18px;font-size:13px;color:#334155;">'
     || '<strong>Customer:</strong> {{customer_name}}<br>'
     || '<strong>Site:</strong> {{branch_name}}<br>'
     || '<strong>Subject:</strong> {{subject}}<br>'
     || '<strong>Priority:</strong> {{priority}}<br>'
     || '<strong>Response due:</strong> {{response_due}}<br>'
     || '<strong>Resolution due:</strong> {{resolution_due}}<br>'
     || '<strong>Contact:</strong> {{contact_person}} - {{contact_phone}}'
     || '</td></tr></table>'
     || '<a href="{{ticket_url}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Open ticket</a>'
     || v_foot,
   E'Hello {{engineer_name}},\n\nTicket {{ticket_number}} has been assigned to you.\n\nCustomer: {{customer_name}}\nSite: {{branch_name}}\nSubject: {{subject}}\nPriority: {{priority}}\nResponse due: {{response_due}}\nResolution due: {{resolution_due}}\nContact: {{contact_person}} - {{contact_phone}}\n\n{{ticket_url}}',
   array['company_name','engineer_name','ticket_number','customer_name','branch_name','subject','priority','response_due','resolution_due','contact_person','contact_phone','ticket_url'],
   false, true, false, false),

  ('ticket_accepted', 'Ticket Accepted',
   'Sent to the customer when an engineer accepts the ticket.',
   '[{{ticket_number}}] {{engineer_name}} is working on your request',
   v_head
     || '<p style="margin:0 0 14px;">Dear {{customer_name}},</p>'
     || '<p style="margin:0 0 18px;"><strong>{{engineer_name}}</strong> has accepted ticket <strong>{{ticket_number}}</strong> and is now working on it.</p>'
     || '<p style="margin:0 0 20px;font-size:13px;color:#475569;">Target resolution: <strong>{{resolution_due}}</strong></p>'
     || '<a href="{{ticket_url}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">View progress</a>'
     || v_foot,
   E'Dear {{customer_name}},\n\n{{engineer_name}} has accepted ticket {{ticket_number}} and is now working on it.\nTarget resolution: {{resolution_due}}\n\n{{ticket_url}}',
   array['company_name','customer_name','engineer_name','ticket_number','resolution_due','ticket_url'],
   true, false, false, false),

  ('engineer_dispatched', 'Engineer Dispatched',
   'Sent when the engineer is on the way to site.',
   '[{{ticket_number}}] Engineer on the way',
   v_head
     || '<p style="margin:0 0 14px;">Dear {{customer_name}},</p>'
     || '<p style="margin:0 0 18px;">Our engineer <strong>{{engineer_name}}</strong> is on the way to <strong>{{branch_name}}</strong> for ticket <strong>{{ticket_number}}</strong>.</p>'
     || '<p style="margin:0 0 20px;font-size:13px;color:#475569;">Please ensure site access is available. You can reach the engineer on {{engineer_phone}}.</p>'
     || v_foot,
   E'Dear {{customer_name}},\n\n{{engineer_name}} is on the way to {{branch_name}} for ticket {{ticket_number}}.\nEngineer contact: {{engineer_phone}}',
   array['company_name','customer_name','engineer_name','engineer_phone','branch_name','ticket_number'],
   true, false, false, false),

  ('ticket_on_hold', 'Ticket On Hold',
   'Sent when a ticket is placed on hold and the SLA clock is paused.',
   '[{{ticket_number}}] On hold - {{hold_reason}}',
   v_head
     || '<p style="margin:0 0 14px;">Dear {{customer_name}},</p>'
     || '<p style="margin:0 0 18px;">Ticket <strong>{{ticket_number}}</strong> has been placed on hold.</p>'
     || '<p style="margin:0 0 8px;font-size:13px;color:#475569;"><strong>Reason:</strong> {{hold_reason}}</p>'
     || '<p style="margin:0 0 20px;font-size:13px;color:#475569;">The resolution clock is paused and will resume as soon as work restarts.</p>'
     || '<a href="{{ticket_url}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">View ticket</a>'
     || v_foot,
   E'Dear {{customer_name}},\n\nTicket {{ticket_number}} has been placed on hold.\nReason: {{hold_reason}}\n\n{{ticket_url}}',
   array['company_name','customer_name','ticket_number','hold_reason','ticket_url'],
   true, false, true, false),

  ('ticket_resolved', 'Ticket Resolved',
   'Sent when the engineer marks the work resolved and asks for confirmation.',
   '[{{ticket_number}}] Resolved - please confirm',
   v_head
     || '<p style="margin:0 0 14px;">Dear {{customer_name}},</p>'
     || '<p style="margin:0 0 18px;">Ticket <strong>{{ticket_number}}</strong> has been resolved by <strong>{{engineer_name}}</strong>.</p>'
     || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin:0 0 18px;">'
     || '<tr><td style="padding:16px 18px;font-size:13px;color:#14532d;">'
     || '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#15803d;margin-bottom:6px;">Resolution</div>'
     || '{{resolution_summary}}</td></tr></table>'
     || '<p style="margin:0 0 20px;">Please confirm the issue is fully resolved. If we do not hear from you, the ticket closes automatically after {{auto_close_days}} days.</p>'
     || '<a href="{{ticket_url}}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Confirm resolution</a>'
     || v_foot,
   E'Dear {{customer_name}},\n\nTicket {{ticket_number}} has been resolved by {{engineer_name}}.\n\nResolution: {{resolution_summary}}\n\nPlease confirm: {{ticket_url}}',
   array['company_name','customer_name','ticket_number','engineer_name','resolution_summary','auto_close_days','ticket_url'],
   true, false, true, false),

  ('ticket_closed', 'Ticket Closed - Service Report',
   'Sent automatically on closure with the signed service report attached.',
   '[{{ticket_number}}] Closed - Service Report {{report_number}}',
   v_head
     || '<p style="margin:0 0 14px;">Dear {{customer_name}},</p>'
     || '<p style="margin:0 0 18px;">Ticket <strong>{{ticket_number}}</strong> has been completed and closed. The signed service report is attached to this message.</p>'
     || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 18px;">'
     || '<tr><td style="padding:16px 18px;font-size:13px;color:#334155;">'
     || '<strong>Service report:</strong> {{report_number}}<br>'
     || '<strong>Issue:</strong> {{subject}}<br>'
     || '<strong>Engineer:</strong> {{engineer_name}}<br>'
     || '<strong>Completed:</strong> {{completion_date}}<br>'
     || '<strong>Site:</strong> {{branch_name}}'
     || '</td></tr></table>'
     || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 20px;">'
     || '<tr><td style="padding:16px 18px;font-size:13px;color:#334155;">'
     || '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:6px;">Work performed</div>'
     || '{{resolution_summary}}</td></tr></table>'
     || '<p style="margin:0 0 20px;">We would value your feedback on this service visit.</p>'
     || '<a href="{{feedback_url}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Rate this service</a>'
     || v_foot,
   E'Dear {{customer_name}},\n\nTicket {{ticket_number}} has been completed and closed. The service report is attached.\n\nService report: {{report_number}}\nIssue: {{subject}}\nEngineer: {{engineer_name}}\nCompleted: {{completion_date}}\nSite: {{branch_name}}\n\nWork performed: {{resolution_summary}}\n\nRate this service: {{feedback_url}}\n\n{{company_name}}',
   array['company_name','customer_name','ticket_number','report_number','subject','engineer_name','completion_date','branch_name','resolution_summary','feedback_url','ticket_url'],
   true, false, true, true),

  ('ticket_reopened', 'Ticket Reopened',
   'Sent to the engineer and management when a customer reopens a ticket.',
   '[{{ticket_number}}] Reopened by the customer',
   v_head
     || '<p style="margin:0 0 14px;">Hello {{engineer_name}},</p>'
     || '<p style="margin:0 0 18px;">{{customer_name}} has reopened ticket <strong>{{ticket_number}}</strong>.</p>'
     || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin:0 0 20px;">'
     || '<tr><td style="padding:16px 18px;font-size:13px;color:#78350f;">'
     || '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#b45309;margin-bottom:6px;">Reason</div>'
     || '{{reopen_reason}}</td></tr></table>'
     || '<a href="{{ticket_url}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Open ticket</a>'
     || v_foot,
   E'Hello {{engineer_name}},\n\n{{customer_name}} has reopened ticket {{ticket_number}}.\nReason: {{reopen_reason}}\n\n{{ticket_url}}',
   array['company_name','engineer_name','customer_name','ticket_number','reopen_reason','ticket_url'],
   false, true, true, false),

  ('sla_warning', 'SLA Warning',
   'Sent to the engineer and management when a ticket approaches its deadline.',
   '[{{ticket_number}}] SLA at risk - {{time_remaining}} remaining',
   v_head
     || '<p style="margin:0 0 14px;">Attention {{engineer_name}},</p>'
     || '<p style="margin:0 0 18px;">Ticket <strong>{{ticket_number}}</strong> is approaching its resolution deadline.</p>'
     || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin:0 0 20px;">'
     || '<tr><td style="padding:16px 18px;font-size:13px;color:#78350f;">'
     || '<strong>Customer:</strong> {{customer_name}}<br>'
     || '<strong>Priority:</strong> {{priority}}<br>'
     || '<strong>Resolution due:</strong> {{resolution_due}}<br>'
     || '<strong>Time remaining:</strong> {{time_remaining}}'
     || '</td></tr></table>'
     || '<a href="{{ticket_url}}" style="display:inline-block;background:#b45309;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Take action</a>'
     || v_foot,
   E'Ticket {{ticket_number}} is approaching its resolution deadline.\n\nCustomer: {{customer_name}}\nPriority: {{priority}}\nResolution due: {{resolution_due}}\nRemaining: {{time_remaining}}\n\n{{ticket_url}}',
   array['company_name','engineer_name','customer_name','ticket_number','priority','resolution_due','time_remaining','ticket_url'],
   false, true, true, false),

  ('sla_breached', 'SLA Breached',
   'Escalation notice sent to management when a resolution deadline passes.',
   '[{{ticket_number}}] SLA BREACHED - immediate attention required',
   v_head
     || '<p style="margin:0 0 14px;">Escalation notice</p>'
     || '<p style="margin:0 0 18px;">Ticket <strong>{{ticket_number}}</strong> has breached its resolution SLA.</p>'
     || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;margin:0 0 20px;">'
     || '<tr><td style="padding:16px 18px;font-size:13px;color:#7f1d1d;">'
     || '<strong>Customer:</strong> {{customer_name}}<br>'
     || '<strong>Engineer:</strong> {{engineer_name}}<br>'
     || '<strong>Priority:</strong> {{priority}}<br>'
     || '<strong>Was due:</strong> {{resolution_due}}<br>'
     || '<strong>Overdue by:</strong> {{overdue_by}}'
     || '</td></tr></table>'
     || '<a href="{{ticket_url}}" style="display:inline-block;background:#b91c1c;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Review now</a>'
     || v_foot,
   E'ESCALATION: Ticket {{ticket_number}} has breached its resolution SLA.\n\nCustomer: {{customer_name}}\nEngineer: {{engineer_name}}\nPriority: {{priority}}\nWas due: {{resolution_due}}\nOverdue by: {{overdue_by}}\n\n{{ticket_url}}',
   array['company_name','customer_name','engineer_name','ticket_number','priority','resolution_due','overdue_by','ticket_url'],
   false, true, true, false),

  ('amc_expiry_warning', 'AMC Expiry Warning',
   'Sent as an annual maintenance contract approaches its expiry date.',
   'AMC {{amc_number}} expires in {{days_remaining}} days',
   v_head
     || '<p style="margin:0 0 14px;">Dear {{customer_name}},</p>'
     || '<p style="margin:0 0 18px;">Your annual maintenance contract <strong>{{amc_number}}</strong> expires on <strong>{{expiry_date}}</strong> - {{days_remaining}} days from now.</p>'
     || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 20px;">'
     || '<tr><td style="padding:16px 18px;font-size:13px;color:#334155;">'
     || '<strong>Contract:</strong> {{amc_number}}<br>'
     || '<strong>Type:</strong> {{contract_type}}<br>'
     || '<strong>Period:</strong> {{start_date}} to {{expiry_date}}'
     || '</td></tr></table>'
     || '<p style="margin:0;">Our account team will contact you shortly to discuss renewal. Please reach out if you would like to review the cover sooner.</p>'
     || v_foot,
   E'Dear {{customer_name}},\n\nYour AMC {{amc_number}} expires on {{expiry_date}} ({{days_remaining}} days).\nType: {{contract_type}}\nPeriod: {{start_date}} to {{expiry_date}}\n\n{{company_name}}',
   array['company_name','customer_name','amc_number','contract_type','start_date','expiry_date','days_remaining'],
   true, false, true, false),

  ('feedback_request', 'Customer Feedback Request',
   'Invites the customer to rate a completed service visit.',
   '[{{ticket_number}}] How did we do?',
   v_head
     || '<p style="margin:0 0 14px;">Dear {{customer_name}},</p>'
     || '<p style="margin:0 0 18px;">Thank you for letting us support you. Ticket <strong>{{ticket_number}}</strong> has been completed by {{engineer_name}}.</p>'
     || '<p style="margin:0 0 20px;">Your feedback takes less than a minute and helps us improve the service we deliver to you.</p>'
     || '<a href="{{feedback_url}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Rate this service</a>'
     || v_foot,
   E'Dear {{customer_name}},\n\nTicket {{ticket_number}} has been completed by {{engineer_name}}.\nPlease rate the service: {{feedback_url}}\n\n{{company_name}}',
   array['company_name','customer_name','ticket_number','engineer_name','feedback_url'],
   true, false, false, false),

  ('password_reset', 'Password Reset',
   'Sent when a user requests a password reset.',
   'Reset your RCT Application password',
   v_head
     || '<p style="margin:0 0 14px;">Hello {{full_name}},</p>'
     || '<p style="margin:0 0 18px;">We received a request to reset the password for your RCT Application account.</p>'
     || '<a href="{{reset_url}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Reset password</a>'
     || '<p style="margin:20px 0 0;font-size:12px;color:#64748b;">This link expires in {{expiry_minutes}} minutes. If you did not request a reset, no action is needed - your password stays unchanged.</p>'
     || v_foot,
   E'Hello {{full_name}},\n\nReset your RCT Application password: {{reset_url}}\nThis link expires in {{expiry_minutes}} minutes.\n\nIf you did not request this, no action is needed.',
   array['company_name','full_name','reset_url','expiry_minutes'],
   false, false, false, false),

  ('welcome_user', 'Welcome / Account Created',
   'Sent when an administrator creates a new account.',
   'Your RCT Application account is ready',
   v_head
     || '<p style="margin:0 0 14px;">Welcome {{full_name}},</p>'
     || '<p style="margin:0 0 18px;">An account has been created for you on the RCT Application service desk.</p>'
     || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:0 0 20px;">'
     || '<tr><td style="padding:16px 18px;font-size:13px;color:#334155;">'
     || '<strong>Email:</strong> {{email}}<br><strong>Role:</strong> {{role}}</td></tr></table>'
     || '<a href="{{activation_url}}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Set your password</a>'
     || '<p style="margin:20px 0 0;font-size:12px;color:#64748b;">For your security, please choose a new password the first time you sign in.</p>'
     || v_foot,
   E'Welcome {{full_name}},\n\nAn account has been created for you on the RCT Application service desk.\nEmail: {{email}}\nRole: {{role}}\n\nSet your password: {{activation_url}}',
   array['company_name','full_name','email','role','activation_url'],
   false, false, false, false)

  on conflict (code) do update
    set name        = excluded.name,
        description = excluded.description,
        subject     = excluded.subject,
        body_html   = excluded.body_html,
        body_text   = excluded.body_text,
        variables   = excluded.variables;
end $$;

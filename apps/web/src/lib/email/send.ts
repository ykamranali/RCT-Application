import 'server-only';

import type { EmailTemplate } from '@rct/types';

import { createAdminSupabase } from '@/lib/supabase/server';

import {
  loadMailConfig,
  sendEmail,
  type EmailAttachment,
  type MailConfig,
  type SendResult,
} from './provider';
import { htmlToText, missingVariables, renderTemplate, type TemplateVars } from './render';

/**
 * Template-driven sending with delivery logging.
 *
 * Every attempt writes an email_logs row before the transport is touched, so
 * a message that fails to send is still visible in the admin console and on
 * the ticket timeline rather than disappearing silently.
 */

export interface SendTemplateOptions {
  templateCode: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  vars: TemplateVars;
  attachments?: EmailAttachment[];
  ticketId?: string | null;
  serviceReportId?: string | null;
  /** Set by the caller when the email is triggered by a specific user. */
  actorId?: string | null;
}

export interface SendTemplateResult extends SendResult {
  logId?: string;
  skipped?: boolean;
  reason?: string;
}

export async function sendTemplatedEmail(
  options: SendTemplateOptions,
): Promise<SendTemplateResult> {
  const supabase = createAdminSupabase();

  const recipients = dedupeAddresses(options.to);
  if (recipients.length === 0) {
    return { ok: false, provider: 'smtp', skipped: true, reason: 'No valid recipient address' };
  }

  const { data: template } = await supabase
    .from('email_templates')
    .select('*')
    .eq('code', options.templateCode)
    .maybeSingle<EmailTemplate>();

  if (!template) {
    return {
      ok: false,
      provider: 'smtp',
      error: `Email template "${options.templateCode}" was not found.`,
    };
  }

  if (!template.is_active) {
    return { ok: false, provider: 'smtp', skipped: true, reason: 'Template is disabled' };
  }

  const subject = renderTemplate(template.subject, options.vars, false);
  const html = renderTemplate(template.body_html, options.vars);
  const text = template.body_text
    ? renderTemplate(template.body_text, options.vars, false)
    : htmlToText(html);

  // Not fatal, but worth recording: a template referencing a variable the
  // caller did not supply usually means a caller was updated and a template
  // was not.
  const missing = missingVariables(template.body_html, options.vars);

  const config: MailConfig | null = await loadMailConfig();

  const { data: logRow } = await supabase
    .from('email_logs')
    .insert({
      template_code: options.templateCode,
      ticket_id: options.ticketId ?? null,
      service_report_id: options.serviceReportId ?? null,
      to_addresses: recipients,
      cc_addresses: dedupeAddresses(options.cc ?? []),
      bcc_addresses: dedupeAddresses(options.bcc ?? []),
      from_address: config?.fromEmail ?? null,
      reply_to: config?.replyTo ?? null,
      subject,
      body_preview: text.slice(0, 500),
      attachments: (options.attachments ?? []).map((a) => ({
        filename: a.filename,
        bytes: a.content.length,
      })),
      provider: config?.provider ?? null,
      status: 'sending',
      attempts: 1,
      created_by: options.actorId ?? null,
    })
    .select('id')
    .single();

  const logId = (logRow as { id: string } | null)?.id;

  const result = await sendEmail(
    {
      to: recipients,
      cc: options.cc,
      bcc: options.bcc,
      subject,
      html,
      text,
      attachments: options.attachments,
    },
    config ?? undefined,
  );

  if (logId) {
    await supabase
      .from('email_logs')
      .update({
        status: result.ok ? 'sent' : 'failed',
        sent_at: result.ok ? new Date().toISOString() : null,
        provider_message_id: result.messageId ?? null,
        last_error:
          result.error ??
          (missing.length ? `Unresolved template variables: ${missing.join(', ')}` : null),
      })
      .eq('id', logId);
  }

  return { ...result, logId };
}

function dedupeAddresses(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim().toLowerCase();
    // Deliberately permissive: real addresses vary more than any regex, and
    // the transport will reject anything genuinely malformed.
    if (trimmed && trimmed.includes('@') && !trimmed.includes(' ')) seen.add(trimmed);
  }
  return [...seen];
}

/** Recipients for a ticket-related notification, honouring template routing. */
export async function resolveTicketRecipients(
  ticketId: string,
  template: Pick<EmailTemplate, 'send_to_customer' | 'send_to_engineer' | 'send_to_management'>,
): Promise<{ to: string[]; cc: string[] }> {
  const supabase = createAdminSupabase();
  const to: string[] = [];
  const cc: string[] = [];

  const { data: ticket } = await supabase
    .from('tickets')
    .select(
      'contact_email, customer_id, assigned_engineer_id, service_manager_id, branch_id',
    )
    .eq('id', ticketId)
    .maybeSingle<{
      contact_email: string | null;
      customer_id: string;
      assigned_engineer_id: string | null;
      service_manager_id: string | null;
      branch_id: string | null;
    }>();

  if (!ticket) return { to, cc };

  if (template.send_to_customer) {
    if (ticket.contact_email) to.push(ticket.contact_email);

    const { data: customer } = await supabase
      .from('customers')
      .select('email')
      .eq('id', ticket.customer_id)
      .maybeSingle<{ email: string | null }>();
    if (customer?.email) to.push(customer.email);

    // Every portal contact for the company also receives it.
    const { data: contacts } = await supabase
      .from('profiles')
      .select('email')
      .eq('customer_id', ticket.customer_id)
      .eq('is_active', true);
    for (const c of contacts ?? []) {
      const email = (c as { email: string | null }).email;
      if (email) to.push(email);
    }
  }

  const staffIds = [
    template.send_to_engineer ? ticket.assigned_engineer_id : null,
    template.send_to_management ? ticket.service_manager_id : null,
  ].filter((id): id is string => !!id);

  if (staffIds.length) {
    const { data: staff } = await supabase.from('employees').select('email').in('id', staffIds);
    for (const s of staff ?? []) {
      const email = (s as { email: string }).email;
      if (email) (template.send_to_engineer ? to : cc).push(email);
    }
  }

  if (template.send_to_management) {
    const { data: managers } = await supabase
      .from('profiles')
      .select('email')
      .in('role', ['management', 'admin', 'super_admin'])
      .eq('is_active', true);
    for (const m of managers ?? []) {
      const email = (m as { email: string | null }).email;
      if (email) cc.push(email);
    }
  }

  return { to: dedupeAddresses(to), cc: dedupeAddresses(cc) };
}

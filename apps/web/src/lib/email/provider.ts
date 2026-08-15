import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';

import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * Transport abstraction over SMTP and Resend.
 *
 * Credentials live in system_settings rows flagged is_secret, which no
 * browser session can read (see the RLS policy in migration 0013). They are
 * fetched here with the service role and never returned to the client.
 * Environment variables are used as a fallback so a deployment can be
 * configured entirely through Vercel if preferred.
 */

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface OutboundEmail {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SendResult {
  ok: boolean;
  provider: 'smtp' | 'resend';
  messageId?: string;
  error?: string;
}

export interface MailConfig {
  provider: 'smtp' | 'resend';
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  smtp?: {
    host: string;
    port: number;
    secure: 'none' | 'tls' | 'ssl';
    username?: string;
    password?: string;
  };
  resendApiKey?: string;
}

/** Read mail configuration, preferring the database over the environment. */
export async function loadMailConfig(): Promise<MailConfig | null> {
  const settings: Record<string, string> = {};

  try {
    const supabase = createAdminSupabase();
    const { data } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'email');

    for (const row of data ?? []) {
      const raw = (row as { key: string; value: unknown }).value;
      settings[(row as { key: string }).key] = typeof raw === 'string' ? raw : String(raw ?? '');
    }
  } catch {
    // No service role key configured, or the settings table is unreachable.
    // Fall through to the environment.
  }

  const provider = (settings.email_provider || process.env.EMAIL_PROVIDER || 'smtp') as
    | 'smtp'
    | 'resend';
  const fromEmail = settings.email_from || process.env.EMAIL_FROM || '';
  const fromName = settings.email_from_name || process.env.EMAIL_FROM_NAME || 'RCT Service Desk';
  const replyTo = settings.email_reply_to || process.env.EMAIL_REPLY_TO || undefined;

  if (!fromEmail) return null;

  if (provider === 'resend') {
    const key = settings.resend_api_key || process.env.RESEND_API_KEY;
    if (!key) return null;
    return { provider, fromEmail, fromName, replyTo, resendApiKey: key };
  }

  const host = settings.smtp_host || process.env.SMTP_HOST;
  if (!host) return null;

  return {
    provider: 'smtp',
    fromEmail,
    fromName,
    replyTo,
    smtp: {
      host,
      port: Number(settings.smtp_port || process.env.SMTP_PORT || 587),
      secure: (settings.smtp_secure || process.env.SMTP_SECURE || 'tls') as 'none' | 'tls' | 'ssl',
      username: settings.smtp_username || process.env.SMTP_USERNAME || undefined,
      password: settings.smtp_password || process.env.SMTP_PASSWORD || undefined,
    },
  };
}

let cachedTransport: { key: string; transporter: Transporter } | null = null;

function getTransporter(config: MailConfig): Transporter {
  const smtp = config.smtp!;
  // Reuse the connection pool across invocations in the same lambda.
  const key = `${smtp.host}:${smtp.port}:${smtp.username ?? ''}`;
  if (cachedTransport?.key === key) return cachedTransport.transporter;

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure === 'ssl',
    requireTLS: smtp.secure === 'tls',
    auth: smtp.username ? { user: smtp.username, pass: smtp.password ?? '' } : undefined,
    pool: true,
    maxConnections: 3,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
  });

  cachedTransport = { key, transporter };
  return transporter;
}

export async function sendEmail(message: OutboundEmail, config?: MailConfig): Promise<SendResult> {
  const cfg = config ?? (await loadMailConfig());

  if (!cfg) {
    return {
      ok: false,
      provider: 'smtp',
      error:
        'Email is not configured. Set the SMTP or Resend details in Settings → Email before sending.',
    };
  }

  const from = `${cfg.fromName} <${cfg.fromEmail}>`;

  try {
    if (cfg.provider === 'resend') {
      const { Resend } = await import('resend');
      const resend = new Resend(cfg.resendApiKey!);

      const { data, error } = await resend.emails.send({
        from,
        to: message.to,
        cc: message.cc,
        bcc: message.bcc,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo ?? cfg.replyTo,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });

      if (error) return { ok: false, provider: 'resend', error: error.message };
      return { ok: true, provider: 'resend', messageId: data?.id };
    }

    const info = await getTransporter(cfg).sendMail({
      from,
      to: message.to.join(', '),
      cc: message.cc?.join(', '),
      bcc: message.bcc?.join(', '),
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo ?? cfg.replyTo,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });

    return { ok: true, provider: 'smtp', messageId: info.messageId };
  } catch (error) {
    return {
      ok: false,
      provider: cfg.provider,
      error: error instanceof Error ? error.message : 'Unknown transport error',
    };
  }
}

/** Used by Settings → Email → Send test email. */
export async function verifyMailConfig(config?: MailConfig): Promise<{ ok: boolean; error?: string }> {
  const cfg = config ?? (await loadMailConfig());
  if (!cfg) return { ok: false, error: 'Email is not configured.' };
  if (cfg.provider === 'resend') return { ok: !!cfg.resendApiKey };

  try {
    await getTransporter(cfg).verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Connection failed' };
  }
}

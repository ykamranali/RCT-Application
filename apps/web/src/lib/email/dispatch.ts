import nodemailer from 'nodemailer';
import { createServerSupabase } from '@/lib/supabase/server';

export async function dispatchEmail({ to, subject, html, text }: { to: string, subject: string, html: string, text: string }) {
  const supabase = await createServerSupabase();

  // Fetch SMTP settings
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_username', 'smtp_password', 'email_from']);

  if (!settings) {
    throw new Error('SMTP settings not found');
  }

  const getSetting = (key: string) => settings.find(s => s.key === key)?.value || '';

  const host = getSetting('smtp_host');
  const port = parseInt(getSetting('smtp_port') || '587');
  const secure = getSetting('smtp_secure') === 'ssl';
  const user = getSetting('smtp_username');
  const pass = getSetting('smtp_password');
  const from = getSetting('email_from') || 'noreply@ramtechuae.com';

  if (!host || !user) {
    console.warn('SMTP not configured properly, skipping email dispatch.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  console.log('Message sent: %s', info.messageId);
}

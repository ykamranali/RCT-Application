import { NextResponse, type NextRequest } from 'next/server';

import { sendTemplatedEmail } from '@/lib/email/send';
import { formatDate } from '@/lib/format';
import { createAdminSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Milestones at which a customer is warned, in days before expiry. */
const WARNING_DAYS = [90, 60, 30, 14, 7];

/**
 * Nightly AMC job: refresh contract statuses against today's date, then send
 * one expiry warning per contract that lands exactly on a milestone. Firing
 * only on the milestones stops a customer being chased every single night
 * for the last three months of their contract.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 500 });
  }

  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    request.nextUrl.searchParams.get('token');

  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const admin = createAdminSupabase();

  const { data: refreshed, error: refreshError } = await admin.rpc('refresh_amc_statuses');
  if (refreshError) {
    return NextResponse.json({ ok: false, error: refreshError.message }, { status: 500 });
  }

  const { data: expiring } = await admin
    .from('v_amc_expiring')
    .select('*')
    .in('expiry_bucket', ['within_30_days', 'within_60_days', 'within_90_days']);

  let notified = 0;

  for (const contract of expiring ?? []) {
    const row = contract as {
      id: string;
      amc_number: string;
      customer_id: string;
      company_name: string;
      contract_type: string;
      start_date: string;
      expiry_date: string;
      days_remaining: number;
    };

    if (!WARNING_DAYS.includes(row.days_remaining)) continue;

    const { data: contacts } = await admin
      .from('profiles')
      .select('email')
      .eq('customer_id', row.customer_id)
      .eq('is_active', true);

    const to = (contacts ?? [])
      .map((c) => (c as { email: string | null }).email)
      .filter((e): e is string => !!e);

    if (to.length === 0) continue;

    const result = await sendTemplatedEmail({
      templateCode: 'amc_expiry_warning',
      to,
      vars: {
        company_name: 'Ram Computer Technology LLC',
        customer_name: row.company_name,
        amc_number: row.amc_number,
        contract_type: row.contract_type,
        start_date: formatDate(row.start_date),
        expiry_date: formatDate(row.expiry_date),
        days_remaining: row.days_remaining,
      },
    });

    if (result.ok) notified += 1;
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    statusesUpdated: refreshed ?? 0,
    warningsSent: notified,
  });
}

export const GET = POST;

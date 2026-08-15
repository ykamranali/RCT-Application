import { NextResponse, type NextRequest } from 'next/server';

import { createAdminSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * SLA sweep. Reclassifies every open ticket and raises at-risk and breach
 * notifications. Intended to run every 15 minutes.
 *
 * Protected by CRON_SECRET: without it, anyone who discovered the URL could
 * spray escalation notifications at every engineer in the company.
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
  const { data, error } = await admin.rpc('sweep_sla');

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), ...result });
}

// Vercel Cron issues GET requests.
export const GET = POST;

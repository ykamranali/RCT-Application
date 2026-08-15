import { NextResponse } from 'next/server';

import { STORAGE_BUCKETS } from '@rct/types';

import { getSession } from '@/lib/auth';
import { safeFileName } from '@/lib/format';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';

/**
 * Service report download.
 *
 * The row is fetched with the caller's own client, so Row Level Security
 * decides whether they may see this report at all. Only once that has
 * succeeded is the service role used to read the private object — the
 * elevated client never sees a user-supplied path.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: report } = await supabase
    .from('service_reports')
    .select('id, report_number, storage_path')
    .eq('id', id)
    .maybeSingle<{ id: string; report_number: string; storage_path: string | null }>();

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }
  if (!report.storage_path) {
    return NextResponse.json(
      { error: 'The PDF for this report has not been generated yet.' },
      { status: 409 },
    );
  }

  const admin = createAdminSupabase();
  const path = report.storage_path.startsWith(`${STORAGE_BUCKETS.reports}/`)
    ? report.storage_path.slice(STORAGE_BUCKETS.reports.length + 1)
    : report.storage_path;

  const { data: file, error } = await admin.storage.from(STORAGE_BUCKETS.reports).download(path);
  if (error || !file) {
    return NextResponse.json({ error: 'The report file could not be retrieved.' }, { status: 502 });
  }

  return new NextResponse(await file.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Service_Report_${safeFileName(report.report_number)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

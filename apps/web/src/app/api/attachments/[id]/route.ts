import { NextResponse } from 'next/server';

import { STORAGE_BUCKETS } from '@rct/types';

import { getSession } from '@/lib/auth';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';

/** Attachment download, gated by the same RLS that governs the ticket. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: attachment } = await supabase
    .from('ticket_attachments')
    .select('storage_path, file_name, mime_type')
    .eq('id', id)
    .maybeSingle<{ storage_path: string; file_name: string; mime_type: string }>();

  if (!attachment) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const admin = createAdminSupabase();
  const path = attachment.storage_path.startsWith(`${STORAGE_BUCKETS.attachments}/`)
    ? attachment.storage_path.slice(STORAGE_BUCKETS.attachments.length + 1)
    : attachment.storage_path;

  const { data: file, error } = await admin.storage.from(STORAGE_BUCKETS.attachments).download(path);
  if (error || !file) {
    return NextResponse.json({ error: 'The file could not be retrieved.' }, { status: 502 });
  }

  return new NextResponse(await file.arrayBuffer(), {
    headers: {
      'Content-Type': attachment.mime_type,
      // Always an attachment, never inline: an uploaded HTML or SVG file
      // rendered inline would execute JavaScript in the application origin.
      'Content-Disposition': `attachment; filename="${attachment.file_name.replace(/"/g, '')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}

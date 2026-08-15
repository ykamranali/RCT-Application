'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { STORAGE_BUCKETS, TICKET_STATUSES } from '@rct/types';

import { assertStaff, getSession } from '@/lib/auth';
import { closeTicketAndIssueReport } from '@/lib/tickets/close-ticket';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';

/**
 * Server actions for the ticket workflow.
 *
 * Each one validates its input with Zod, then relies on Row Level Security
 * and the database triggers for the actual authorisation and state-machine
 * enforcement. The checks here exist to produce good error messages, not to
 * be the security boundary.
 */

export interface ActionResult<T = undefined> {
  ok: boolean;
  message?: string;
  data?: T;
}

/** Convert a Postgres error into something a user can act on. */
function friendly(message: string): string {
  const map: [RegExp, string][] = [
    [/Illegal ticket transition: (\w+) -> (\w+)/, 'That status change is not allowed from where the ticket is now.'],
    [/Diagnosis is required/, 'Add the diagnosis before resolving this ticket.'],
    [/Work performed is required/, 'Record what work was carried out before resolving this ticket.'],
    [/tickets_resolved_requires_summary/, 'Write a resolution summary before resolving this ticket.'],
    [/customer signature is required/, 'Capture the customer signature before closing this ticket.'],
    [/cannot be resolved without an assigned engineer/, 'Assign an engineer before resolving this ticket.'],
    [/violates row-level security|new row violates/, 'You do not have permission to make that change.'],
    [/duplicate key/, 'That record already exists.'],
    [/Branch does not belong/, 'That site does not belong to the selected customer.'],
  ];
  for (const [pattern, text] of map) {
    if (pattern.test(message)) return text;
  }
  return 'The change could not be saved. Please try again.';
}

function revalidateTicket(id: string) {
  revalidatePath(`/tickets/${id}`);
  revalidatePath('/tickets');
  revalidatePath('/engineer');
  revalidatePath(`/engineer/tickets/${id}`);
  revalidatePath('/dashboard');
}

// ---------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------

const statusSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(TICKET_STATUSES),
  note: z.string().max(2000).optional(),
  cancellationReason: z.string().max(1000).optional(),
});

export async function updateTicketStatus(
  input: z.infer<typeof statusSchema>,
): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That request was not valid.' };

  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session has expired. Please sign in again.' };

  const { ticketId, status, note, cancellationReason } = parsed.data;

  // Closure is a pipeline, not a single update.
  if (status === 'CLOSED') {
    const result = await closeTicketAndIssueReport(ticketId, { actorId: session.userId });
    revalidateTicket(ticketId);
    if (!result.ok) return { ok: false, message: result.error };
    return {
      ok: true,
      message: result.emailSent
        ? `Ticket closed. Service report ${result.reportNumber} was emailed to the customer.`
        : `Ticket closed. Service report ${result.reportNumber} was created.${
            result.warnings.length ? ` ${result.warnings[0]}` : ''
          }`,
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('tickets')
    .update({
      status,
      ...(status === 'CANCELLED' && cancellationReason
        ? { cancellation_reason: cancellationReason }
        : {}),
    })
    .eq('id', ticketId);

  if (error) return { ok: false, message: friendly(error.message) };

  if (note?.trim()) {
    await supabase.from('ticket_comments').insert({
      ticket_id: ticketId,
      author_id: session.userId,
      author_name: session.profile.full_name,
      author_role: session.profile.role,
      body: note.trim(),
      is_internal: true,
    });
  }

  revalidateTicket(ticketId);
  return { ok: true, message: 'Status updated.' };
}

// ---------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------

const assignSchema = z.object({
  ticketId: z.string().uuid(),
  engineerId: z.string().uuid().nullable(),
  serviceManagerId: z.string().uuid().nullable().optional(),
});

export async function assignTicket(input: z.infer<typeof assignSchema>): Promise<ActionResult> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That request was not valid.' };

  await assertStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('tickets')
    .update({
      assigned_engineer_id: parsed.data.engineerId,
      ...(parsed.data.serviceManagerId !== undefined
        ? { service_manager_id: parsed.data.serviceManagerId }
        : {}),
    })
    .eq('id', parsed.data.ticketId);

  if (error) return { ok: false, message: friendly(error.message) };

  revalidateTicket(parsed.data.ticketId);
  return { ok: true, message: parsed.data.engineerId ? 'Engineer assigned.' : 'Engineer removed.' };
}

/** Engineer self-accept, routed through the validating RPC. */
export async function acceptTicket(ticketId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(ticketId).success) {
    return { ok: false, message: 'That request was not valid.' };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('engineer_accept_ticket', { p_ticket_id: ticketId });
  if (error) return { ok: false, message: friendly(error.message) };

  revalidateTicket(ticketId);
  return { ok: true, message: 'Ticket accepted. The customer has been notified.' };
}

// ---------------------------------------------------------------------
// Work detail
// ---------------------------------------------------------------------

const workSchema = z.object({
  ticketId: z.string().uuid(),
  diagnosis: z.string().max(5000).optional(),
  workPerformed: z.string().max(5000).optional(),
  resolutionSummary: z.string().max(5000).optional(),
  engineerRemarks: z.string().max(5000).optional(),
  rootCause: z.string().max(2000).optional(),
  isBillable: z.boolean().optional(),
});

export async function saveWorkDetail(input: z.infer<typeof workSchema>): Promise<ActionResult> {
  const parsed = workSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That request was not valid.' };

  const supabase = await createServerSupabase();
  const { ticketId, ...fields } = parsed.data;

  const { error } = await supabase
    .from('tickets')
    .update({
      ...(fields.diagnosis !== undefined ? { diagnosis: fields.diagnosis } : {}),
      ...(fields.workPerformed !== undefined ? { work_performed: fields.workPerformed } : {}),
      ...(fields.resolutionSummary !== undefined ? { resolution_summary: fields.resolutionSummary } : {}),
      ...(fields.engineerRemarks !== undefined ? { engineer_remarks: fields.engineerRemarks } : {}),
      ...(fields.rootCause !== undefined ? { root_cause: fields.rootCause } : {}),
      ...(fields.isBillable !== undefined ? { is_billable: fields.isBillable } : {}),
    })
    .eq('id', ticketId);

  if (error) return { ok: false, message: friendly(error.message) };

  revalidateTicket(ticketId);
  return { ok: true, message: 'Saved.' };
}

/**
 * Resolve in a single round trip: the mandatory fields and the status
 * change go together, so the database validates them as one statement.
 */
const resolveSchema = z.object({
  ticketId: z.string().uuid(),
  diagnosis: z.string().min(5, 'Describe what you found (at least 5 characters)'),
  workPerformed: z.string().min(5, 'Describe the work carried out (at least 5 characters)'),
  resolutionSummary: z.string().min(10, 'Summarise the resolution for the customer (at least 10 characters)'),
  engineerRemarks: z.string().max(5000).optional(),
});

export async function resolveTicket(input: z.infer<typeof resolveSchema>): Promise<ActionResult> {
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'That request was not valid.' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('tickets')
    .update({
      status: 'RESOLVED',
      diagnosis: parsed.data.diagnosis,
      work_performed: parsed.data.workPerformed,
      resolution_summary: parsed.data.resolutionSummary,
      ...(parsed.data.engineerRemarks ? { engineer_remarks: parsed.data.engineerRemarks } : {}),
    })
    .eq('id', parsed.data.ticketId);

  if (error) return { ok: false, message: friendly(error.message) };

  revalidateTicket(parsed.data.ticketId);
  return { ok: true, message: 'Ticket resolved. The customer has been asked to confirm.' };
}

// ---------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------

const commentSchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().min(1, 'Write something first').max(5000),
  isInternal: z.boolean().default(false),
});

export async function addComment(input: z.infer<typeof commentSchema>): Promise<ActionResult> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'That request was not valid.' };
  }

  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session has expired. Please sign in again.' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('ticket_comments').insert({
    ticket_id: parsed.data.ticketId,
    author_id: session.userId,
    author_name: session.profile.full_name,
    author_role: session.profile.role,
    body: parsed.data.body.trim(),
    // RLS rejects an internal note from a customer, but do not even try.
    is_internal: parsed.data.isInternal,
  });

  if (error) return { ok: false, message: friendly(error.message) };

  revalidateTicket(parsed.data.ticketId);
  revalidatePath(`/portal/tickets/${parsed.data.ticketId}`);
  return { ok: true, message: 'Comment added.' };
}

// ---------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------

const partSchema = z.object({
  ticketId: z.string().uuid(),
  partName: z.string().min(2, 'Enter the part description').max(200),
  serialNumber: z.string().max(120).optional(),
  quantity: z.number().positive('Quantity must be greater than zero').max(9999),
  unit: z.string().max(20).default('pcs'),
  unitCost: z.number().min(0).max(10_000_000).nullable().optional(),
  isReplacement: z.boolean().default(false),
  remarks: z.string().max(1000).optional(),
});

export async function addTicketPart(input: z.infer<typeof partSchema>): Promise<ActionResult> {
  const parsed = partSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'That request was not valid.' };
  }

  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session has expired. Please sign in again.' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('ticket_parts').insert({
    ticket_id: parsed.data.ticketId,
    part_name: parsed.data.partName.trim(),
    serial_number: parsed.data.serialNumber?.trim() || null,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit,
    unit_cost: parsed.data.unitCost ?? null,
    is_replacement: parsed.data.isReplacement,
    remarks: parsed.data.remarks?.trim() || null,
    recorded_by: session.userId,
  });

  if (error) return { ok: false, message: friendly(error.message) };

  revalidateTicket(parsed.data.ticketId);
  return { ok: true, message: 'Part recorded.' };
}

export async function removeTicketPart(partId: string, ticketId: string): Promise<ActionResult> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from('ticket_parts').delete().eq('id', partId);
  if (error) return { ok: false, message: friendly(error.message) };
  revalidateTicket(ticketId);
  return { ok: true, message: 'Part removed.' };
}

// ---------------------------------------------------------------------
// Site visit checkpoints
// ---------------------------------------------------------------------

const visitSchema = z.object({
  ticketId: z.string().uuid(),
  stage: z.enum(['TRAVEL_STARTED', 'ARRIVED', 'WORK_STARTED', 'PAUSED', 'RESUMED', 'WORK_COMPLETED', 'DEPARTED']),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  notes: z.string().max(1000).optional(),
});

export async function recordVisitStage(input: z.infer<typeof visitSchema>): Promise<ActionResult> {
  const parsed = visitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'That request was not valid.' };

  const session = await getSession();
  if (!session?.profile.employee_id) {
    return { ok: false, message: 'Only an engineer can record a site visit.' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('ticket_visits').insert({
    ticket_id: parsed.data.ticketId,
    engineer_id: session.profile.employee_id,
    stage: parsed.data.stage,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    notes: parsed.data.notes?.trim() || null,
  });

  if (error) return { ok: false, message: friendly(error.message) };

  // Arriving on site and starting work also move the ticket forward.
  if (parsed.data.stage === 'ARRIVED') {
    await supabase.from('tickets').update({ status: 'ON_SITE' }).eq('id', parsed.data.ticketId);
  } else if (parsed.data.stage === 'WORK_STARTED') {
    await supabase.from('tickets').update({ status: 'IN_PROGRESS' }).eq('id', parsed.data.ticketId);
  }

  revalidateTicket(parsed.data.ticketId);
  return { ok: true, message: 'Recorded.' };
}

// ---------------------------------------------------------------------
// Signature capture
// ---------------------------------------------------------------------

const signatureSchema = z.object({
  ticketId: z.string().uuid(),
  signerName: z.string().min(2, 'Enter the name of the person signing').max(160),
  signerTitle: z.string().max(120).optional(),
  signerType: z.enum(['customer', 'engineer']).default('customer'),
  /** data:image/png;base64,... produced by the signature canvas. */
  dataUrl: z.string().startsWith('data:image/png;base64,', 'The signature could not be read'),
});

export async function saveSignature(input: z.infer<typeof signatureSchema>): Promise<ActionResult> {
  const parsed = signatureSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'That request was not valid.' };
  }

  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session has expired. Please sign in again.' };

  const base64 = parsed.data.dataUrl.split(',')[1] ?? '';
  const bytes = Buffer.from(base64, 'base64');

  // A blank canvas still produces a valid PNG, so guard on size.
  if (bytes.length < 400) {
    return { ok: false, message: 'The signature looks empty. Please sign again.' };
  }
  if (bytes.length > 2 * 1024 * 1024) {
    return { ok: false, message: 'That signature image is too large.' };
  }

  const admin = createAdminSupabase();
  const path = `${parsed.data.ticketId}/${crypto.randomUUID()}.png`;

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKETS.signatures)
    .upload(path, bytes, { contentType: 'image/png', upsert: false });

  if (uploadError) {
    return { ok: false, message: 'The signature could not be stored. Please try again.' };
  }

  const hash = await sha256Hex(bytes);

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('customer_signatures').insert({
    ticket_id: parsed.data.ticketId,
    signer_type: parsed.data.signerType,
    signer_name: parsed.data.signerName.trim(),
    signer_title: parsed.data.signerTitle?.trim() || null,
    storage_path: path,
    content_hash: hash,
    captured_by: session.userId,
  });

  if (error) {
    // Roll back the orphaned object rather than leaving it in the bucket.
    await admin.storage.from(STORAGE_BUCKETS.signatures).remove([path]);
    return { ok: false, message: friendly(error.message) };
  }

  revalidateTicket(parsed.data.ticketId);
  return { ok: true, message: 'Signature captured.' };
}

async function sha256Hex(bytes: Buffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------
// Customer-side actions (validated inside the database)
// ---------------------------------------------------------------------

export async function reopenTicket(ticketId: string, reason: string): Promise<ActionResult> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('customer_reopen_ticket', {
    p_ticket_id: ticketId,
    p_reason: reason,
  });

  if (error) {
    // These RPCs raise messages written for the customer, so pass them on.
    return { ok: false, message: error.message.replace(/^.*?:\s*/, '') };
  }

  revalidateTicket(ticketId);
  revalidatePath(`/portal/tickets/${ticketId}`);
  return { ok: true, message: 'Ticket reopened. Our team has been notified.' };
}

export async function decideWork(
  ticketId: string,
  approved: boolean,
  comments?: string,
): Promise<ActionResult> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('customer_decide_work', {
    p_ticket_id: ticketId,
    p_approved: approved,
    p_comments: comments ?? null,
  });

  if (error) return { ok: false, message: error.message.replace(/^.*?:\s*/, '') };

  revalidatePath(`/portal/tickets/${ticketId}`);
  return {
    ok: true,
    message: approved ? 'Thank you for confirming.' : 'Thank you — we will take another look.',
  };
}

const feedbackSchema = z.object({
  ticketId: z.string().uuid(),
  customerId: z.string().uuid(),
  engineerId: z.string().uuid().nullable().optional(),
  overallRating: z.number().int().min(1).max(5),
  engineerRating: z.number().int().min(1).max(5).optional(),
  serviceRating: z.number().int().min(1).max(5).optional(),
  responseRating: z.number().int().min(1).max(5).optional(),
  issueResolved: z.boolean().optional(),
  comments: z.string().max(2000).optional(),
});

export async function submitFeedback(input: z.infer<typeof feedbackSchema>): Promise<ActionResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Please choose a rating before submitting.' };

  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session has expired. Please sign in again.' };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('customer_feedback').insert({
    ticket_id: parsed.data.ticketId,
    customer_id: parsed.data.customerId,
    engineer_id: parsed.data.engineerId ?? null,
    submitted_by: session.userId,
    overall_rating: parsed.data.overallRating,
    engineer_rating: parsed.data.engineerRating ?? null,
    service_rating: parsed.data.serviceRating ?? null,
    response_rating: parsed.data.responseRating ?? null,
    issue_resolved: parsed.data.issueResolved ?? null,
    comments: parsed.data.comments?.trim() || null,
  });

  if (error) {
    if (error.message.includes('customer_feedback_one_per_ticket')) {
      return { ok: false, message: 'Feedback has already been submitted for this ticket.' };
    }
    return { ok: false, message: friendly(error.message) };
  }

  revalidatePath(`/portal/tickets/${parsed.data.ticketId}`);
  return { ok: true, message: 'Thank you for your feedback.' };
}

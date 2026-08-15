'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { isCustomer } from '@rct/types';

import { getSession } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Ticket creation.
 *
 * A customer principal may only ever raise a ticket against their own
 * company: the customer_id is taken from their profile and the value sent
 * by the browser is ignored entirely. RLS enforces the same rule, so a
 * forged request fails twice.
 */

const schema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, 'Give the issue a short title (at least 3 characters)')
    .max(200, 'Please keep the title under 200 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Describe the problem in a little more detail (at least 10 characters)')
    .max(10_000),
  categoryId: z.string().uuid('Choose a category'),
  subcategoryId: z.string().uuid().nullable().optional(),
  priorityId: z.string().uuid('Choose a priority'),
  branchId: z.string().uuid().nullable().optional(),
  contactPerson: z.string().trim().max(160).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  contactEmail: z.string().trim().email('Enter a valid email address').max(200).optional().or(z.literal('')),
  preferredVisitAt: z.string().datetime().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
  /** Staff only — ignored when a customer submits. */
  customerId: z.string().uuid().optional(),
  assignedEngineerId: z.string().uuid().nullable().optional(),
});

export interface CreateTicketResult {
  ok: boolean;
  message?: string;
  ticketId?: string;
  ticketNumber?: string;
  fieldErrors?: Record<string, string>;
}

export async function createTicket(input: unknown): Promise<CreateTicketResult> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: 'Please correct the highlighted fields.', fieldErrors };
  }

  const session = await getSession();
  if (!session) {
    return { ok: false, message: 'Your session has expired. Please sign in again.' };
  }

  const customerFacing = isCustomer(session.profile.role);

  // Never trust a browser-supplied tenant for a customer principal.
  const customerId = customerFacing ? session.profile.customer_id : parsed.data.customerId;

  if (!customerId) {
    return {
      ok: false,
      message: customerFacing
        ? 'Your account is not linked to a company. Please contact the service desk.'
        : 'Choose the customer this ticket is for.',
      fieldErrors: customerFacing ? undefined : { customerId: 'Choose a customer' },
    };
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('tickets')
    .insert({
      customer_id: customerId,
      branch_id: parsed.data.branchId ?? session.profile.branch_id ?? null,
      category_id: parsed.data.categoryId,
      subcategory_id: parsed.data.subcategoryId ?? null,
      priority_id: parsed.data.priorityId,
      subject: parsed.data.subject,
      description: parsed.data.description,
      contact_person: parsed.data.contactPerson || session.profile.full_name,
      contact_phone: parsed.data.contactPhone || session.profile.phone || null,
      contact_email: parsed.data.contactEmail || session.profile.email || null,
      preferred_visit_at: parsed.data.preferredVisitAt ?? null,
      asset_id: parsed.data.assetId ?? null,
      created_by: session.userId,
      // Only staff may pre-assign; a customer's value is discarded.
      assigned_engineer_id: customerFacing ? null : (parsed.data.assignedEngineerId ?? null),
    })
    .select('id, ticket_number')
    .single<{ id: string; ticket_number: string }>();

  if (error) {
    if (error.message.includes('Branch does not belong')) {
      return {
        ok: false,
        message: 'That site does not belong to the selected customer.',
        fieldErrors: { branchId: 'Choose a site for this customer' },
      };
    }
    if (error.message.includes('row-level security')) {
      return { ok: false, message: 'You do not have permission to raise a ticket for that company.' };
    }
    return { ok: false, message: 'Unable to create ticket. Please try again.' };
  }

  revalidatePath('/tickets');
  revalidatePath('/portal');
  revalidatePath('/portal/tickets');
  revalidatePath('/dashboard');

  return { ok: true, ticketId: data.id, ticketNumber: data.ticket_number };
}

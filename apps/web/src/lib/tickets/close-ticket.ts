import 'server-only';

import { STORAGE_BUCKETS, type Ticket } from '@rct/types';

import { sendTemplatedEmail } from '@/lib/email/send';
import { appUrl } from '@/lib/env';
import { formatDateTime, safeFileName } from '@/lib/format';
import { buildServiceReportPdf, type ServiceReportData } from '@/lib/pdf/service-report';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';

/**
 * Ticket closure pipeline.
 *
 * Spec section 17 requires that closing a ticket produces a service report
 * and emails it, with no manual step. The order matters:
 *
 *   1. move the ticket to CLOSED   - the database validates the transition
 *      and the mandatory fields, so an invalid closure fails here and
 *      nothing else happens
 *   2. create the service_reports row  - allocates SR-YYYY-NNNNNN
 *   3. render the PDF
 *   4. store it in the private bucket and record the path
 *   5. email the customer and management with the PDF attached
 *   6. write a timeline entry recording the delivery outcome
 *
 * Steps 3-6 are best-effort: if the PDF or the mail transport fails, the
 * ticket stays closed and the failure is recorded on the timeline and in
 * email_logs, rather than rolling back work the engineer already completed.
 */

export interface CloseTicketResult {
  ok: boolean;
  ticket?: Ticket;
  reportId?: string;
  reportNumber?: string;
  storagePath?: string;
  emailSent: boolean;
  warnings: string[];
  error?: string;
}

export async function closeTicketAndIssueReport(
  ticketId: string,
  options: { actorId: string; customerRemarks?: string | null } = { actorId: '' },
): Promise<CloseTicketResult> {
  const warnings: string[] = [];
  const supabase = await createServerSupabase();

  // ---- 1. Close the ticket, under the caller's own permissions ---------
  const { data: closed, error: closeError } = await supabase
    .from('tickets')
    .update({
      status: 'CLOSED',
      ...(options.customerRemarks ? { customer_remarks: options.customerRemarks } : {}),
    })
    .eq('id', ticketId)
    .select('*')
    .maybeSingle<Ticket>();

  if (closeError) {
    return { ok: false, emailSent: false, warnings, error: friendlyDbError(closeError.message) };
  }
  if (!closed) {
    return {
      ok: false,
      emailSent: false,
      warnings,
      error: 'This ticket could not be closed. It may already be closed, or you may not have access to it.',
    };
  }

  // ---- 2. Assemble everything the report needs ------------------------
  const admin = createAdminSupabase();
  const context = await loadReportContext(admin, ticketId);

  if (!context) {
    warnings.push('The ticket was closed but the service report could not be assembled.');
    return { ok: true, ticket: closed, emailSent: false, warnings };
  }

  const { data: report, error: reportError } = await admin
    .from('service_reports')
    .insert({
      ticket_id: ticketId,
      customer_id: closed.customer_id,
      branch_id: closed.branch_id,
      engineer_id: closed.assigned_engineer_id,
      complaint_summary: closed.subject,
      diagnosis: closed.diagnosis,
      work_performed: closed.work_performed,
      engineer_remarks: closed.engineer_remarks,
      customer_remarks: closed.customer_remarks,
      parts_summary: context.parts,
      service_started_at: closed.work_started_at,
      arrival_at: closed.on_site_at,
      completion_at: closed.resolved_at,
      total_minutes: context.totalMinutes,
      customer_signature_id: context.customerSignatureId,
      customer_signed_name: context.customerSignerName,
      engineer_signed_name: context.engineer?.full_name ?? null,
      final_status: 'CLOSED',
      generated_by: options.actorId || null,
      snapshot: context.snapshot,
    })
    .select('id, report_number')
    .single<{ id: string; report_number: string }>();

  if (reportError || !report) {
    warnings.push('The ticket was closed but the service report record could not be created.');
    return { ok: true, ticket: closed, emailSent: false, warnings };
  }

  // ---- 3. Render the PDF ----------------------------------------------
  let pdf: Buffer | null = null;
  try {
    pdf = await buildServiceReportPdf(
      buildReportData(report.report_number, closed, context),
    );
  } catch (error) {
    warnings.push(
      `The service report PDF could not be generated: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
  }

  // ---- 4. Store it -----------------------------------------------------
  let storagePath: string | undefined;
  if (pdf) {
    storagePath = `${ticketId}/${safeFileName(report.report_number)}.pdf`;
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKETS.reports)
      .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      warnings.push(`The service report could not be stored: ${uploadError.message}`);
      storagePath = undefined;
    } else {
      await admin
        .from('service_reports')
        .update({
          storage_path: storagePath,
          file_size_bytes: pdf.length,
          pdf_generated_at: new Date().toISOString(),
        })
        .eq('id', report.id);
    }
  }

  // ---- 5. Email it -----------------------------------------------------
  let emailSent = false;
  const autoEmail = await settingIsTrue(admin, 'auto_email_on_close', true);

  if (autoEmail) {
    const recipients = await collectRecipients(admin, closed.customer_id, context);

    if (recipients.to.length === 0) {
      warnings.push('No customer email address is on file, so the report was not emailed.');
    } else {
      const send = await sendTemplatedEmail({
        templateCode: 'ticket_closed',
        to: recipients.to,
        cc: recipients.cc,
        ticketId,
        serviceReportId: report.id,
        actorId: options.actorId || null,
        vars: {
          company_name: context.company.name,
          customer_name: context.customerContactName,
          ticket_number: closed.ticket_number,
          report_number: report.report_number,
          subject: closed.subject,
          engineer_name: context.engineer?.full_name ?? 'our engineer',
          completion_date: formatDateTime(closed.resolved_at),
          branch_name: context.branch?.branch_name ?? 'Head office',
          resolution_summary: closed.resolution_summary ?? '',
          ticket_url: appUrl(`/portal/tickets/${ticketId}`),
          feedback_url: appUrl(`/feedback/${ticketId}`),
        },
        attachments: pdf
          ? [
              {
                filename: `Service_Report_${safeFileName(report.report_number)}.pdf`,
                content: pdf,
                contentType: 'application/pdf',
              },
            ]
          : undefined,
      });

      emailSent = send.ok;
      if (!send.ok) {
        warnings.push(
          send.reason ?? send.error ?? 'The closure email could not be delivered.',
        );
      }
    }
  }

  // ---- 6. Record the outcome on the timeline ---------------------------
  await admin.from('ticket_status_history').insert({
    ticket_id: ticketId,
    to_status: 'CLOSED',
    event_type: 'service_report',
    note: emailSent
      ? `Service report ${report.report_number} issued and emailed to the customer`
      : `Service report ${report.report_number} issued${
          warnings.length ? ' (delivery incomplete)' : ''
        }`,
    changed_by: options.actorId || null,
    changed_by_name: 'System',
    metadata: {
      report_number: report.report_number,
      storage_path: storagePath ?? null,
      email_sent: emailSent,
      warnings,
    },
  });

  return {
    ok: true,
    ticket: closed,
    reportId: report.id,
    reportNumber: report.report_number,
    storagePath,
    emailSent,
    warnings,
  };
}

// ---------------------------------------------------------------------
// Context assembly
// ---------------------------------------------------------------------

type Admin = ReturnType<typeof createAdminSupabase>;

interface ReportContext {
  company: ServiceReportData['company'];
  customer: { company_name: string; customer_code: string | null; email: string | null; phone: string | null; contact_person: string | null };
  customerContactName: string;
  branch: { branch_name: string; address_line1: string | null; city: string | null; emirate: string | null; contact_person: string | null; phone: string | null } | null;
  engineer: { full_name: string; employee_code: string; job_title: string | null; phone: string | null } | null;
  asset: { asset_tag: string; name: string; serial_number: string | null } | null;
  category: string | null;
  subcategory: string | null;
  priority: string | null;
  slaPlan: string | null;
  parts: ServiceReportData['parts'];
  totalMinutes: number | null;
  customerSignatureId: string | null;
  customerSignerName: string | null;
  customerSignatureImage: Buffer | null;
  customerSignedAt: string | null;
  snapshot: Record<string, unknown>;
}

async function loadReportContext(admin: Admin, ticketId: string): Promise<ReportContext | null> {
  const { data: ticket } = await admin
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle<Ticket>();
  if (!ticket) return null;

  const [customerRes, branchRes, engineerRes, assetRes, categoryRes, subRes, priorityRes, planRes, partsRes, timeRes, sigRes] =
    await Promise.all([
      admin.from('customers').select('company_name, customer_code, email, phone, contact_person').eq('id', ticket.customer_id).maybeSingle(),
      ticket.branch_id
        ? admin.from('branches').select('branch_name, address_line1, city, emirate, contact_person, phone').eq('id', ticket.branch_id).maybeSingle()
        : Promise.resolve({ data: null }),
      ticket.assigned_engineer_id
        ? admin.from('employees').select('full_name, employee_code, job_title, phone').eq('id', ticket.assigned_engineer_id).maybeSingle()
        : Promise.resolve({ data: null }),
      ticket.asset_id
        ? admin.from('assets').select('asset_tag, name, serial_number').eq('id', ticket.asset_id).maybeSingle()
        : Promise.resolve({ data: null }),
      ticket.category_id
        ? admin.from('categories').select('name').eq('id', ticket.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      ticket.subcategory_id
        ? admin.from('subcategories').select('name').eq('id', ticket.subcategory_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from('priorities').select('name').eq('id', ticket.priority_id).maybeSingle(),
      ticket.sla_plan_id
        ? admin.from('sla_plans').select('name').eq('id', ticket.sla_plan_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from('ticket_parts').select('*').eq('ticket_id', ticketId),
      admin.from('ticket_time_entries').select('minutes_spent').eq('ticket_id', ticketId),
      admin
        .from('customer_signatures')
        .select('id, signer_name, storage_path, signed_at')
        .eq('ticket_id', ticketId)
        .eq('signer_type', 'customer')
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const company = await loadCompanyBranding(admin);

  const signature = sigRes.data as
    | { id: string; signer_name: string; storage_path: string; signed_at: string }
    | null;

  let signatureImage: Buffer | null = null;
  if (signature?.storage_path) {
    const { data } = await admin.storage
      .from(STORAGE_BUCKETS.signatures)
      .download(stripBucketPrefix(signature.storage_path, STORAGE_BUCKETS.signatures));
    if (data) signatureImage = Buffer.from(await data.arrayBuffer());
  }

  const parts = (partsRes.data ?? []).map((p) => {
    const row = p as {
      part_name: string;
      serial_number: string | null;
      quantity: number;
      unit: string;
      unit_cost: number | null;
      currency: string;
      remarks: string | null;
    };
    return {
      name: row.part_name,
      serialNumber: row.serial_number,
      quantity: Number(row.quantity),
      unit: row.unit,
      unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
      currency: row.currency,
      remarks: row.remarks,
    };
  });

  const totalMinutes =
    (timeRes.data ?? []).reduce(
      (sum, row) => sum + Number((row as { minutes_spent: number | null }).minutes_spent ?? 0),
      0,
    ) || null;

  const customer = customerRes.data as ReportContext['customer'];
  const branch = branchRes.data as ReportContext['branch'];

  return {
    company,
    customer,
    customerContactName:
      branch?.contact_person || customer?.contact_person || customer?.company_name || 'Customer',
    branch,
    engineer: engineerRes.data as ReportContext['engineer'],
    asset: assetRes.data as ReportContext['asset'],
    category: (categoryRes.data as { name: string } | null)?.name ?? null,
    subcategory: (subRes.data as { name: string } | null)?.name ?? null,
    priority: (priorityRes.data as { name: string } | null)?.name ?? null,
    slaPlan: (planRes.data as { name: string } | null)?.name ?? null,
    parts,
    totalMinutes,
    customerSignatureId: signature?.id ?? null,
    customerSignerName: signature?.signer_name ?? null,
    customerSignatureImage: signatureImage,
    customerSignedAt: signature?.signed_at ?? null,
    snapshot: {
      ticket_number: ticket.ticket_number,
      customer_name: customer?.company_name,
      branch_name: branch?.branch_name,
      category: (categoryRes.data as { name: string } | null)?.name,
      priority: (priorityRes.data as { name: string } | null)?.name,
      captured_at: new Date().toISOString(),
    },
  };
}

function buildReportData(
  reportNumber: string,
  ticket: Ticket,
  ctx: ReportContext,
): ServiceReportData {
  return {
    company: ctx.company,
    report: {
      number: reportNumber,
      generatedAt: new Date().toISOString(),
      finalStatus: 'CLOSED',
    },
    ticket: {
      number: ticket.ticket_number,
      subject: ticket.subject,
      description: ticket.description,
      category: ctx.category,
      subcategory: ctx.subcategory,
      priority: ctx.priority,
      createdAt: ticket.created_at,
      slaPlan: ctx.slaPlan,
      resolutionState: ticket.resolution_state,
      resolutionDueAt: ticket.resolution_due_at,
    },
    customer: {
      name: ctx.customer?.company_name ?? '—',
      code: ctx.customer?.customer_code ?? null,
      contactPerson: ctx.customer?.contact_person ?? null,
      phone: ctx.customer?.phone ?? null,
      email: ctx.customer?.email ?? null,
    },
    branch: ctx.branch
      ? {
          name: ctx.branch.branch_name,
          address: ctx.branch.address_line1,
          city: ctx.branch.city,
          emirate: ctx.branch.emirate,
          contactPerson: ctx.branch.contact_person,
          phone: ctx.branch.phone,
        }
      : null,
    asset: ctx.asset
      ? { tag: ctx.asset.asset_tag, name: ctx.asset.name, serialNumber: ctx.asset.serial_number }
      : null,
    engineer: {
      name: ctx.engineer?.full_name ?? '—',
      code: ctx.engineer?.employee_code ?? null,
      jobTitle: ctx.engineer?.job_title ?? null,
      phone: ctx.engineer?.phone ?? null,
    },
    work: {
      complaint: ticket.description,
      diagnosis: ticket.diagnosis,
      workPerformed: ticket.work_performed,
      engineerRemarks: ticket.engineer_remarks,
      customerRemarks: ticket.customer_remarks,
      startedAt: ticket.work_started_at,
      arrivedAt: ticket.on_site_at,
      completedAt: ticket.resolved_at,
      totalMinutes: ctx.totalMinutes,
    },
    parts: ctx.parts,
    signatures: {
      customerName: ctx.customerSignerName,
      customerTitle: 'Site contact',
      customerImage: ctx.customerSignatureImage,
      customerSignedAt: ctx.customerSignedAt,
      engineerName: ctx.engineer?.full_name ?? null,
      engineerImage: null,
    },
  };
}

async function loadCompanyBranding(admin: Admin): Promise<ServiceReportData['company']> {
  const { data } = await admin
    .from('system_settings')
    .select('key, value')
    .eq('category', 'company');

  const settings: Record<string, string> = {};
  for (const row of data ?? []) {
    const r = row as { key: string; value: unknown };
    settings[r.key] = typeof r.value === 'string' ? r.value : String(r.value ?? '');
  }

  let logo: Buffer | null = null;
  const logoPath = settings.company_logo_path;
  if (logoPath) {
    const { data: file } = await admin.storage
      .from(STORAGE_BUCKETS.company)
      .download(stripBucketPrefix(logoPath, STORAGE_BUCKETS.company));
    if (file) logo = Buffer.from(await file.arrayBuffer());
  }

  return {
    name: settings.company_name || 'Ram Computer Technology LLC',
    address: settings.company_address || null,
    phone: settings.company_phone || null,
    email: settings.company_email || null,
    website: settings.company_website || null,
    trn: settings.company_trn || null,
    footer: settings.report_footer || settings.company_name || null,
    logo,
  };
}

async function collectRecipients(
  admin: Admin,
  customerId: string,
  ctx: ReportContext,
): Promise<{ to: string[]; cc: string[] }> {
  const to = new Set<string>();
  const cc = new Set<string>();

  if (ctx.customer?.email) to.add(ctx.customer.email.toLowerCase());

  const { data: contacts } = await admin
    .from('profiles')
    .select('email')
    .eq('customer_id', customerId)
    .eq('is_active', true);
  for (const c of contacts ?? []) {
    const email = (c as { email: string | null }).email;
    if (email) to.add(email.toLowerCase());
  }

  const { data: managers } = await admin
    .from('profiles')
    .select('email')
    .in('role', ['management', 'service_manager', 'admin', 'super_admin'])
    .eq('is_active', true);
  for (const m of managers ?? []) {
    const email = (m as { email: string | null }).email;
    if (email) cc.add(email.toLowerCase());
  }

  return { to: [...to], cc: [...cc] };
}

async function settingIsTrue(admin: Admin, key: string, fallback: boolean): Promise<boolean> {
  const { data } = await admin.from('system_settings').select('value').eq('key', key).maybeSingle();
  const raw = (data as { value: unknown } | null)?.value;
  if (raw === undefined || raw === null) return fallback;
  const text = typeof raw === 'string' ? raw : String(raw);
  return text === 'true' || text === '1';
}

/** Storage paths are sometimes stored with the bucket prefix, sometimes not. */
function stripBucketPrefix(path: string, bucket: string): string {
  return path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
}

/** Turn a Postgres trigger message into something a user can act on. */
function friendlyDbError(message: string): string {
  if (message.includes('Illegal ticket transition')) {
    return 'This ticket cannot be closed from its current status.';
  }
  if (message.includes('customer signature is required')) {
    return 'A customer signature must be captured before this ticket can be closed.';
  }
  if (message.includes('Diagnosis is required')) {
    return 'Add the diagnosis before closing this ticket.';
  }
  if (message.includes('Work performed is required')) {
    return 'Record the work performed before closing this ticket.';
  }
  if (message.includes('tickets_resolved_requires_summary')) {
    return 'A resolution summary is required before this ticket can be closed.';
  }
  return 'The ticket could not be closed. Please try again.';
}

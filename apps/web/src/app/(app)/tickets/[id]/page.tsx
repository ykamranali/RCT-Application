import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2, Download, HardDrive, MapPin, Phone, User } from 'lucide-react';

import type { TicketComment, TicketPart, TicketStatusHistory } from '@rct/types';

import { PageHeader } from '@/components/shell/page-header';
import { CommentThread } from '@/components/tickets/comment-box';
import { PriorityBadge, SlaBadge, StatusBadge } from '@/components/tickets/status-badge';
import { TicketActions } from '@/components/tickets/ticket-actions';
import { Timeline } from '@/components/tickets/timeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireStaff } from '@/lib/auth';
import { formatCurrency, formatDateTime, formatDuration } from '@/lib/format';
import {
  getTicket, getTicketAttachments, getTicketComments, getTicketParts, getTicketTimeline,
} from '@/lib/queries';
import { createServerSupabase } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ticket = await getTicket(id);
  return { title: ticket ? `${ticket.ticket_number} — ${ticket.subject}` : 'Ticket' };
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaff();
  const { id } = await params;

  const ticket = await getTicket(id);
  if (!ticket) notFound();

  const supabase = await createServerSupabase();
  const [timeline, comments, parts, attachments, engineers, signatures] = await Promise.all([
    getTicketTimeline(id),
    getTicketComments(id),
    getTicketParts(id),
    getTicketAttachments(id),
    supabase.from('employees').select('id, full_name, employee_code').eq('role', 'engineer').eq('status', 'active').order('full_name'),
    supabase.from('customer_signatures').select('id, signer_name, signed_at').eq('ticket_id', id).eq('signer_type', 'customer'),
  ]);

  const partRows = parts as TicketPart[];
  const partsTotal = partRows.reduce((sum, p) => sum + Number(p.total_cost ?? 0), 0);
  const hasSignature = (signatures.data?.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground">
        <Link href="/tickets"><ArrowLeft className="h-4 w-4" /> All tickets</Link>
      </Button>

      <PageHeader
        title={ticket.subject}
        description={`${ticket.ticket_number} · raised ${formatDateTime(ticket.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge code={ticket.priority_code} name={ticket.priority_name} colour={ticket.priority_colour} />
            <SlaBadge state={ticket.resolution_state} remainingMinutes={ticket.resolution_remaining_minutes} paused={ticket.sla_paused} />
            {ticket.service_report_id ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/api/reports/${ticket.service_report_id}/download`}>
                  <Download className="h-4 w-4" /> {ticket.report_number}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,300px)]">
        {/* ---- left: context ---- */}
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Customer</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Row icon={Building2} label="Company" value={ticket.customer_name ?? '—'} />
              <Row icon={MapPin} label="Site" value={ticket.branch_name ?? 'Head office'} />
              <Row icon={User} label="Contact" value={ticket.customer_code ?? '—'} />
              {ticket.asset_tag ? (
                <Row icon={HardDrive} label="Asset" value={`${ticket.asset_tag}${ticket.asset_name ? ` · ${ticket.asset_name}` : ''}`} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Service level</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Field label="Response due" value={formatDateTime(ticket.response_due_at)} />
              <Field label="Resolution due" value={formatDateTime(ticket.resolution_due_at)} />
              <Field label="First response" value={ticket.response_minutes_actual ? formatDuration(ticket.response_minutes_actual) : 'Awaiting'} />
              <Field label="Time to resolve" value={ticket.resolution_minutes_actual ? formatDuration(ticket.resolution_minutes_actual) : '—'} />
              {ticket.reopen_count > 0 ? (
                <Field label="Reopened" value={`${ticket.reopen_count} time${ticket.reopen_count === 1 ? '' : 's'}`} />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Assignment</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Field label="Engineer" value={ticket.engineer_name ?? 'Unassigned'} />
              <Field label="Service manager" value={ticket.service_manager_name ?? '—'} />
              <Field label="Category" value={ticket.category_name ?? '—'} />
              {ticket.subcategory_name ? <Field label="Type" value={ticket.subcategory_name} /> : null}
            </CardContent>
          </Card>
        </aside>

        {/* ---- centre: narrative ---- */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Reported issue</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
              {ticket.contact_person || ticket.contact_phone ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {[ticket.contact_person, ticket.contact_phone].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {ticket.diagnosis || ticket.work_performed || ticket.resolution_summary ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Work record</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {ticket.diagnosis ? <Block label="Diagnosis" body={ticket.diagnosis} /> : null}
                {ticket.work_performed ? <Block label="Work performed" body={ticket.work_performed} /> : null}
                {ticket.resolution_summary ? <Block label="Resolution" body={ticket.resolution_summary} /> : null}
                {ticket.engineer_remarks ? <Block label="Engineer remarks" body={ticket.engineer_remarks} /> : null}
              </CardContent>
            </Card>
          ) : null}

          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
              <TabsTrigger value="parts">Parts ({partRows.length})</TabsTrigger>
              <TabsTrigger value="files">Files ({attachments.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline">
              <Card><CardContent className="pt-5"><Timeline events={timeline as TicketStatusHistory[]} /></CardContent></Card>
            </TabsContent>

            <TabsContent value="comments">
              <CommentThread ticketId={ticket.id} comments={comments as TicketComment[]} role={session.profile.role} />
            </TabsContent>

            <TabsContent value="parts">
              <Card>
                <CardContent className="pt-5">
                  {partRows.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No parts recorded.</p>
                  ) : (
                    <>
                      <ul className="divide-y">
                        {partRows.map((part) => (
                          <li key={part.id} className="flex items-center justify-between gap-3 py-2.5">
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{part.part_name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {part.quantity} {part.unit}
                                {part.serial_number ? ` · ${part.serial_number}` : ''}
                              </span>
                            </span>
                            <span className="tabular shrink-0 text-sm">{formatCurrency(Number(part.total_cost), part.currency)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 flex justify-between border-t pt-3 text-sm font-medium">
                        <span>Total</span>
                        <span className="tabular">{formatCurrency(partsTotal)}</span>
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files">
              <Card>
                <CardContent className="pt-5">
                  {attachments.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No files attached.</p>
                  ) : (
                    <ul className="divide-y">
                      {attachments.map((file: any) => (
                        <li key={file.id} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{file.file_name}</span>
                            <span className="block text-xs text-muted-foreground">{file.kind}</span>
                          </span>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/api/attachments/${file.id}`}>
                              <Download className="h-3.5 w-3.5" /> Download
                            </Link>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ---- right: actions ---- */}
        <TicketActions
          ticket={ticket}
          role={session.profile.role}
          employeeId={session.profile.employee_id}
          engineers={(engineers.data as { id: string; full_name: string; employee_code: string }[] | null) ?? []}
          hasSignature={hasSignature}
        />
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm">{value}</p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tabular text-right text-sm">{value}</span>
    </div>
  );
}

function Block({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </div>
  );
}

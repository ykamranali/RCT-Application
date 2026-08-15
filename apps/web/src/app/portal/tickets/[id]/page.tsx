import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, MapPin, Wrench } from 'lucide-react';

import type { TicketComment, TicketStatusHistory } from '@rct/types';

import { PageHeader } from '@/components/shell/page-header';
import { CommentThread } from '@/components/tickets/comment-box';
import { CustomerActions } from '@/components/tickets/customer-actions';
import { PriorityBadge, SlaBadge, StatusBadge } from '@/components/tickets/status-badge';
import { Timeline } from '@/components/tickets/timeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireCustomer } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { getTicket, getTicketComments, getTicketTimeline } from '@/lib/queries';
import { createServerSupabase } from '@/lib/supabase/server';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ticket = await getTicket(id);
  return { title: ticket ? `${ticket.ticket_number} — ${ticket.subject}` : 'Ticket' };
}

export default async function PortalTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCustomer();
  const { id } = await params;

  const ticket = await getTicket(id);
  if (!ticket) notFound();

  const supabase = await createServerSupabase();
  const [timeline, comments, feedback] = await Promise.all([
    getTicketTimeline(id),
    getTicketComments(id),
    supabase.from('customer_feedback').select('id').eq('ticket_id', id).maybeSingle(),
  ]);

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground">
        <Link href="/portal/tickets"><ArrowLeft className="h-4 w-4" /> Your tickets</Link>
      </Button>

      <PageHeader
        title={ticket.subject}
        description={`${ticket.ticket_number} · raised ${formatDateTime(ticket.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge code={ticket.priority_code} name={ticket.priority_name} colour={ticket.priority_colour} />
            {ticket.service_report_id ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/api/reports/${ticket.service_report_id}/download`}>
                  <Download className="h-4 w-4" /> Service report
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">What you reported</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
            </CardContent>
          </Card>

          {ticket.resolution_summary ? (
            <Card className="border-success/40">
              <CardHeader className="pb-3"><CardTitle className="text-sm">How we resolved it</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.resolution_summary}</p>
                {ticket.work_performed ? (
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Work carried out</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{ticket.work_performed}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Tabs defaultValue="timeline">
            <TabsList>
              <TabsTrigger value="timeline">Progress</TabsTrigger>
              <TabsTrigger value="comments">Messages ({comments.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline">
              <Card><CardContent className="pt-5"><Timeline events={timeline as TicketStatusHistory[]} /></CardContent></Card>
            </TabsContent>
            <TabsContent value="comments">
              <CommentThread ticketId={ticket.id} comments={comments as TicketComment[]} role={session.profile.role} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <CustomerActions ticket={ticket} hasFeedback={!!feedback.data} />

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Row label="Status" value={ticket.status.replace(/_/g, ' ').toLowerCase()} />
              <Row label="Category" value={ticket.category_name ?? '—'} />
              <Row label="Site" value={ticket.branch_name ?? 'Head office'} />
              <Row label="Expected resolution" value={formatDateTime(ticket.resolution_due_at)} />
              {ticket.resolved_at ? <Row label="Resolved" value={formatDateTime(ticket.resolved_at)} /> : null}
              {ticket.closed_at ? <Row label="Closed" value={formatDateTime(ticket.closed_at)} /> : null}
            </CardContent>
          </Card>

          {ticket.engineer_name ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Your engineer</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Wrench className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{ticket.engineer_name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" aria-hidden /> Ram Computer Technology
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!ticket.sla_paused && ticket.resolution_state !== 'not_applicable' ? (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Service level</CardTitle></CardHeader>
              <CardContent>
                <SlaBadge
                  state={ticket.resolution_state}
                  remainingMinutes={ticket.resolution_remaining_minutes}
                  paused={ticket.sla_paused}
                />
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm capitalize">{value}</span>
    </div>
  );
}

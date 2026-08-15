import type { Metadata } from 'next';
import Link from 'next/link';
import { AlarmClock, CheckCircle2, ClipboardList, Star, TriangleAlert } from 'lucide-react';

import type { TicketOverview } from '@rct/types';

import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { TicketTable } from '@/components/tickets/ticket-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'My day' };

export default async function EngineerHomePage() {
  const session = await requireRole('engineer');
  const employeeId = session.profile.employee_id;
  const supabase = await createServerSupabase();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // RLS already limits these to tickets this engineer may see; the explicit
  // filter narrows them further to work that is actually theirs.
  const base = () =>
    supabase.from('v_tickets_overview').select('*').eq('assigned_engineer_id', employeeId ?? '');

  const [open, breached, completedToday, ratings] = await Promise.all([
    base()
      .not('status', 'in', '("CLOSED","CANCELLED","RESOLVED")')
      .order('resolution_due_at', { ascending: true, nullsFirst: false })
      .limit(50),
    base()
      .in('resolution_state', ['breached', 'at_risk'])
      .not('status', 'in', '("CLOSED","CANCELLED","RESOLVED")'),
    base().gte('resolved_at', startOfToday.toISOString()),
    supabase
      .from('customer_feedback')
      .select('overall_rating')
      .eq('engineer_id', employeeId ?? ''),
  ]);

  const myTickets = (open.data as TicketOverview[] | null) ?? [];
  const atRisk = (breached.data as TicketOverview[] | null) ?? [];
  const doneToday = (completedToday.data as TicketOverview[] | null) ?? [];

  const scores = (ratings.data ?? []).map((r) => (r as { overall_rating: number }).overall_rating);
  const avgRating = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
    : '—';

  const firstName = session.profile.full_name.split(' ')[0];
  const needsAccepting = myTickets.filter((t) => t.status === 'ASSIGNED');

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day, ${firstName}`}
        description={
          myTickets.length === 0
            ? 'You have no open jobs right now.'
            : `You have ${myTickets.length} open job${myTickets.length === 1 ? '' : 's'}.`
        }
      />

      <section aria-label="Your figures" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open jobs" value={myTickets.length} icon={ClipboardList} href="/engineer/tickets" />
        <StatCard label="Needs attention" value={atRisk.length} icon={AlarmClock} tone={atRisk.length ? 'danger' : 'success'} />
        <StatCard label="Completed today" value={doneToday.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Your rating" value={avgRating === '—' ? '—' : `${avgRating} / 5`} icon={Star} hint={`${scores.length} review${scores.length === 1 ? '' : 's'}`} />
      </section>

      {needsAccepting.length > 0 ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base">Waiting for you to accept</CardTitle>
            <CardDescription>
              Accepting stops the response clock and tells the customer you are on it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {needsAccepting.map((ticket) => (
                <li key={ticket.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <Link href={`/engineer/tickets/${ticket.id}`} className="block truncate text-sm font-medium hover:underline">
                      {ticket.subject}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ticket.ticket_number} · {ticket.customer_name}
                      {ticket.branch_name ? ` · ${ticket.branch_name}` : ''}
                    </span>
                  </span>
                  <Button asChild size="sm">
                    <Link href={`/engineer/tickets/${ticket.id}`}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {atRisk.length > 0 ? (
        <Card className="border-danger/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="h-4 w-4 text-danger" aria-hidden /> At risk or overdue
            </CardTitle>
            <CardDescription>These need attention before anything else today.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 md:p-2">
            <TicketTable tickets={atRisk} basePath="/engineer/tickets" showEngineer={false} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your open jobs</CardTitle>
          <CardDescription>Ordered by resolution deadline, soonest first</CardDescription>
        </CardHeader>
        <CardContent className={myTickets.length ? 'p-0 md:p-2' : undefined}>
          {myTickets.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing open"
              description="Every job assigned to you is resolved or closed. New work will appear here as soon as it is dispatched."
              className="border-0"
            />
          ) : (
            <TicketTable tickets={myTickets} basePath="/engineer/tickets" showEngineer={false} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

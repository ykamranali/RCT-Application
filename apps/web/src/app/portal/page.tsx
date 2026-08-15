import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Clock, MessageSquarePlus, Ticket, TicketCheck, Wrench } from 'lucide-react';

import type { TicketOverview } from '@rct/types';

import { StatCard } from '@/components/dashboard/stat-card';
import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { TicketTable } from '@/components/tickets/ticket-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireCustomer } from '@/lib/auth';
import { getDashboardStats } from '@/lib/queries';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Your service desk' };

export default async function PortalHomePage() {
  const session = await requireCustomer();
  const supabase = await createServerSupabase();

  // Every query below is automatically scoped to this customer by RLS.
  const [stats, recent, awaiting] = await Promise.all([
    getDashboardStats(),
    supabase
      .from('v_tickets_overview')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('v_tickets_overview')
      .select('*')
      .eq('status', 'RESOLVED')
      .order('resolved_at', { ascending: false })
      .limit(5),
  ]);

  const recentTickets = (recent.data as TicketOverview[] | null) ?? [];
  const awaitingConfirmation = (awaiting.data as TicketOverview[] | null) ?? [];
  const firstName = session.profile.full_name.split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Raise a complaint, follow progress and download your service reports."
        actions={
          <Button asChild>
            <Link href="/portal/tickets/new">
              <MessageSquarePlus className="h-4 w-4" /> Raise a complaint
            </Link>
          </Button>
        }
      />

      {stats ? (
        <section aria-label="Your ticket summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total tickets" value={stats.total_tickets} icon={Ticket} href="/portal/tickets" />
          <StatCard label="Open" value={stats.open_tickets} icon={Clock} tone="info" href="/portal/tickets?status=open" hint={`${stats.in_progress} in progress`} />
          <StatCard label="Awaiting your confirmation" value={stats.resolved} icon={TicketCheck} tone={stats.resolved > 0 ? 'warning' : 'default'} href="/portal/tickets?status=RESOLVED" />
          <StatCard label="Closed" value={stats.closed} icon={CheckCircle2} tone="success" href="/portal/tickets?status=CLOSED" />
        </section>
      ) : null}

      {awaitingConfirmation.length > 0 ? (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-base">Please confirm these are resolved</CardTitle>
            <CardDescription>
              Our engineer has marked this work complete. Confirming closes the ticket and issues
              your service report.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {awaitingConfirmation.map((ticket) => (
                <li key={ticket.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <Link href={`/portal/tickets/${ticket.id}`} className="block truncate text-sm font-medium hover:underline">
                      {ticket.subject}
                    </Link>
                    <span className="block truncate text-xs text-muted-foreground">
                      {ticket.ticket_number}
                      {ticket.engineer_name ? ` · resolved by ${ticket.engineer_name}` : ''}
                    </span>
                  </span>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/portal/tickets/${ticket.id}`}>Review</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Recent tickets</CardTitle>
            <CardDescription>Your most recently raised service requests</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/portal/tickets">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className={recentTickets.length ? 'p-0 md:p-2' : undefined}>
          {recentTickets.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No tickets yet"
              description="When you raise a complaint it will appear here, and you can follow it right through to the signed service report."
              action={
                <Button asChild>
                  <Link href="/portal/tickets/new">Raise your first complaint</Link>
                </Button>
              }
              className="border-0"
            />
          ) : (
            <TicketTable tickets={recentTickets} basePath="/portal/tickets" showCustomer={false} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

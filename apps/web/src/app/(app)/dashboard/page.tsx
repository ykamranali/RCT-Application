import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlarmClock, CheckCircle2, Clock, Gauge, Star, Ticket, TrendingUp, TriangleAlert,
} from 'lucide-react';

import type { EngineerPerformance, TicketOverview } from '@rct/types';

import { CategoryChart, EngineerLoadChart, PriorityChart, TicketTrendChart } from '@/components/dashboard/charts';
import { StatCard } from '@/components/dashboard/stat-card';
import { PageHeader } from '@/components/shell/page-header';
import { SlaBadge, StatusBadge } from '@/components/tickets/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireManagement } from '@/lib/auth';
import { formatDateTime, formatDuration, formatPercent } from '@/lib/format';
import { getDashboardStats } from '@/lib/queries';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dashboard' };

const RANGES = {
  today: { label: 'Today', days: 1 },
  week: { label: 'This week', days: 7 },
  month: { label: 'This month', days: 30 },
  quarter: { label: 'Quarter', days: 90 },
  year: { label: 'Year', days: 365 },
} as const;

type RangeKey = keyof typeof RANGES;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireManagement();

  const { range } = await searchParams;
  const key: RangeKey = (range && range in RANGES ? range : 'month') as RangeKey;
  const from = new Date(Date.now() - RANGES[key].days * 86_400_000);

  const supabase = await createServerSupabase();
  const [stats, attention, engineers] = await Promise.all([
    getDashboardStats(from),
    supabase
      .from('v_tickets_overview')
      .select('*')
      .not('status', 'in', '("CLOSED","CANCELLED","RESOLVED")')
      .in('resolution_state', ['breached', 'at_risk'])
      .order('resolution_due_at', { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from('v_engineer_performance')
      .select('engineer_name, tickets_open, tickets_completed')
      .gte('period_month', from.toISOString().slice(0, 10)),
  ]);

  const needsAttention = (attention.data as TicketOverview[] | null) ?? [];
  const load = (engineers.data as Pick<EngineerPerformance, 'engineer_name' | 'tickets_open' | 'tickets_completed'>[] | null) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service desk overview"
        description={`Operational performance for the last ${RANGES[key].days} days.`}
        actions={
          <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
            {(Object.keys(RANGES) as RangeKey[]).map((r) => (
              <Button
                key={r}
                asChild
                size="sm"
                variant={r === key ? 'secondary' : 'ghost'}
                className="h-7 px-2.5 text-xs"
              >
                <Link href={`/dashboard?range=${r}`}>{RANGES[r].label}</Link>
              </Button>
            ))}
          </div>
        }
      />

      {!stats ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Dashboard figures could not be loaded. Please refresh the page.
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total tickets" value={stats.total_tickets} icon={Ticket} href="/tickets" hint={`${stats.new_tickets} raised and untouched`} />
            <StatCard label="Open" value={stats.open_tickets} icon={Clock} tone="info" href="/tickets?status=open" hint={`${stats.in_progress} being worked on`} />
            <StatCard label="Overdue" value={stats.overdue} icon={AlarmClock} tone={stats.overdue > 0 ? 'danger' : 'success'} href="/sla" hint={`${stats.sla_at_risk} approaching deadline`} />
            <StatCard label="SLA compliance" value={formatPercent(stats.sla_compliance)} icon={Gauge} tone={slaTone(stats.sla_compliance)} href="/sla" hint={`${stats.sla_breached} breached`} />
          </section>

          <section aria-label="Quality figures" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} tone="success" href="/tickets?status=RESOLVED" />
            <StatCard label="Closed" value={stats.closed} icon={CheckCircle2} href="/tickets?status=CLOSED" />
            <StatCard label="Avg resolution" value={stats.avg_resolution_hours ? formatDuration(stats.avg_resolution_hours * 60) : '—'} icon={TrendingUp} hint={stats.avg_response_minutes ? `First response ${formatDuration(stats.avg_response_minutes)}` : undefined} />
            <StatCard label="Customer satisfaction" value={stats.csat ? `${stats.csat.toFixed(2)} / 5` : '—'} icon={Star} tone={stats.csat && stats.csat >= 4 ? 'success' : 'default'} hint={`${stats.reopened} tickets reopened`} />
          </section>

          <section aria-label="Trends" className="grid gap-4 lg:grid-cols-2">
            <TicketTrendChart data={stats.monthly_trend} />
            <CategoryChart data={stats.by_category} />
            <PriorityChart data={stats.by_priority} />
            <EngineerLoadChart data={load} />
          </section>
        </>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-warning" aria-hidden />
              Needs attention
            </CardTitle>
            <CardDescription>Open tickets that have breached or are close to breaching</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/sla">Open SLA monitor</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {needsAttention.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing is at risk right now. Every open ticket is inside its SLA.
            </p>
          ) : (
            <ul className="divide-y">
              {needsAttention.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="flex flex-wrap items-center gap-3 py-2.5 transition-colors hover:bg-accent/50"
                  >
                    <span className="tabular w-32 shrink-0 font-mono text-xs font-medium">{ticket.ticket_number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{ticket.subject}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {ticket.customer_name}
                        {ticket.engineer_name ? ` · ${ticket.engineer_name}` : ' · unassigned'}
                      </span>
                    </span>
                    <StatusBadge status={ticket.status} />
                    <SlaBadge
                      state={ticket.resolution_state}
                      remainingMinutes={ticket.resolution_remaining_minutes}
                      paused={ticket.sla_paused}
                    />
                    <span className="hidden w-36 shrink-0 text-right text-xs text-muted-foreground xl:block">
                      {formatDateTime(ticket.resolution_due_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function slaTone(value: number | null): 'success' | 'warning' | 'danger' | 'default' {
  if (value === null) return 'default';
  if (value >= 95) return 'success';
  if (value >= 85) return 'warning';
  return 'danger';
}

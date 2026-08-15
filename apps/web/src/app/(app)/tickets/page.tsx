import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Ticket as TicketIcon } from 'lucide-react';

import { OPEN_STATUSES, type TicketStatus } from '@rct/types';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { TicketFilters } from '@/components/tickets/ticket-filters';
import { TicketTable } from '@/components/tickets/ticket-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireStaff } from '@/lib/auth';
import { getFormOptions, listTickets } from '@/lib/queries';

export const metadata: Metadata = { title: 'Tickets' };

const PAGE_SIZE = 25;

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireStaff();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const statusParam = params.status;

  const status: TicketStatus[] | undefined =
    statusParam === 'open'
      ? ([...OPEN_STATUSES] as TicketStatus[])
      : statusParam
        ? [statusParam as TicketStatus]
        : undefined;

  const [{ tickets, total }, options] = await Promise.all([
    listTickets({
      status,
      priority: params.priority,
      customerId: params.customer,
      engineerId: params.engineer,
      categoryId: params.category,
      slaState: params.sla,
      search: params.q,
      sort: (params.sort as 'newest' | 'oldest' | 'due' | 'priority') ?? 'newest',
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    getFormOptions(),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tickets"
        description={`${total.toLocaleString()} ticket${total === 1 ? '' : 's'} match the current filters.`}
        actions={
          <Button asChild>
            <Link href="/tickets/new"><Plus className="h-4 w-4" /> New ticket</Link>
          </Button>
        }
      />

      <TicketFilters
        customers={options.customers.map((c: any) => ({ id: c.id, label: c.company_name }))}
        engineers={options.engineers.map((e: any) => ({ id: e.id, label: e.full_name }))}
        categories={options.categories.map((c: any) => ({ id: c.id, label: c.name }))}
      />

      {tickets.length === 0 ? (
        <EmptyState
          icon={TicketIcon}
          title="No tickets match those filters"
          description="Try widening the date range or clearing a filter."
          action={
            <Button asChild variant="outline">
              <Link href="/tickets">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <TicketTable tickets={tickets} />
          </CardContent>
        </Card>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <p className="text-xs text-muted-foreground">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildHref(params, page - 1)}>Previous</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Previous</Button>
            )}
            {page < pages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildHref(params, page + 1)}>Next</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Next</Button>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function buildHref(params: Record<string, string | undefined>, page: number): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') next.set(key, value);
  }
  next.set('page', String(Math.max(1, page)));
  return `/tickets?${next.toString()}`;
}

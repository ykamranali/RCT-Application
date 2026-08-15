import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageSquarePlus, Ticket } from 'lucide-react';

import { OPEN_STATUSES, type TicketStatus } from '@rct/types';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { TicketFilters } from '@/components/tickets/ticket-filters';
import { TicketTable } from '@/components/tickets/ticket-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireCustomer } from '@/lib/auth';
import { listTickets } from '@/lib/queries';

export const metadata: Metadata = { title: 'Your tickets' };

const PAGE_SIZE = 25;

export default async function PortalTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireCustomer();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);

  const status: TicketStatus[] | undefined =
    params.status === 'open'
      ? ([...OPEN_STATUSES] as TicketStatus[])
      : params.status
        ? [params.status as TicketStatus]
        : undefined;

  const { tickets, total } = await listTickets({
    status,
    priority: params.priority,
    slaState: params.sla,
    search: params.q,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Your tickets"
        description={`${total.toLocaleString()} ticket${total === 1 ? '' : 's'} raised by your company.`}
        actions={
          <Button asChild>
            <Link href="/portal/tickets/new">
              <MessageSquarePlus className="h-4 w-4" /> Raise a complaint
            </Link>
          </Button>
        }
      />

      {/* Customer and engineer pickers are deliberately omitted here. */}
      <TicketFilters showCustomer={false} showEngineer={false} />

      {tickets.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No tickets match those filters"
          description="Try clearing the filters, or raise a new complaint."
          action={
            <Button asChild variant="outline">
              <Link href="/portal/tickets">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <TicketTable
              tickets={tickets}
              basePath="/portal/tickets"
              showCustomer={false}
              showEngineer
            />
          </CardContent>
        </Card>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <p className="text-xs text-muted-foreground">Page {page} of {pages}</p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/portal/tickets?page=${page - 1}`}>Previous</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Previous</Button>
            )}
            {page < pages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/portal/tickets?page=${page + 1}`}>Next</Link>
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

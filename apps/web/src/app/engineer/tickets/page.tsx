import type { Metadata } from 'next';

import { OPEN_STATUSES, type TicketStatus } from '@rct/types';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { TicketFilters } from '@/components/tickets/ticket-filters';
import { TicketTable } from '@/components/tickets/ticket-table';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { listTickets } from '@/lib/queries';

export const metadata: Metadata = { title: 'My tickets' };

export default async function EngineerTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireRole('engineer');
  const params = await searchParams;

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
    engineerId: session.profile.employee_id ?? undefined,
    sort: 'due',
    limit: 50,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="My tickets"
        description={`${total} ticket${total === 1 ? '' : 's'} assigned to you.`}
      />

      <TicketFilters showCustomer={false} showEngineer={false} />

      {tickets.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tickets match those filters"
          description="Try clearing a filter to see more of your work."
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <TicketTable tickets={tickets} basePath="/engineer/tickets" showEngineer={false} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

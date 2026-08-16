import type { Metadata } from 'next';
import { CalendarDays } from 'lucide-react';

import { OPEN_STATUSES, type TicketStatus } from '@rct/types';
import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { TicketTable } from '@/components/tickets/ticket-table';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';
import { listTickets } from '@/lib/queries';

export const metadata: Metadata = { title: 'My Schedule' };

export default async function EngineerSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireRole('engineer');

  // For the schedule, we only want open tickets, strictly sorted by due date
  const { tickets, total } = await listTickets({
    status: [...OPEN_STATUSES] as TicketStatus[],
    engineerId: session.profile.employee_id ?? undefined,
    sort: 'due',
    limit: 100, // Load more for a schedule view
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Schedule"
        description={`You have ${total} upcoming task${total === 1 ? '' : 's'} to resolve.`}
      />

      {tickets.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Schedule is clear"
          description="You don't have any open tickets assigned to you at the moment."
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

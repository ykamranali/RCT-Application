import type { Metadata } from 'next';
import { Activity, AlertTriangle, XCircle } from 'lucide-react';

import { PageHeader } from '@/components/shell/page-header';
import { TicketTable } from '@/components/tickets/ticket-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireStaff } from '@/lib/auth';
import { listTickets } from '@/lib/queries';

export const metadata: Metadata = { title: 'SLA Monitor' };

export default async function SlaMonitorPage() {
  await requireStaff();

  const [breachedResult, atRiskResult] = await Promise.all([
    listTickets({ slaState: 'breached', limit: 100 }),
    listTickets({ slaState: 'at_risk', limit: 100 }),
  ]);

  const breachedTickets = breachedResult.tickets.filter(t => !['CLOSED', 'CANCELLED'].includes(t.status));
  const atRiskTickets = atRiskResult.tickets.filter(t => !['CLOSED', 'CANCELLED'].includes(t.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA Monitor"
        description="Real-time monitor for tickets approaching or exceeding their service level agreements."
      />

      <div className="grid gap-6">
        <Card className="border-danger/20 shadow-sm shadow-danger/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-danger">
              <XCircle className="h-5 w-5 mr-2" />
              Breached SLAs ({breachedTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-2">
            {breachedTickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No active breached tickets. Great job!
              </div>
            ) : (
              <TicketTable tickets={breachedTickets} />
            )}
          </CardContent>
        </Card>

        <Card className="border-warning/20 shadow-sm shadow-warning/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-warning">
              <AlertTriangle className="h-5 w-5 mr-2" />
              At Risk ({atRiskTickets.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 md:p-2">
            {atRiskTickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No active tickets at risk.
              </div>
            ) : (
              <TicketTable tickets={atRiskTickets} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

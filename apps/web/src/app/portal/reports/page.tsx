import type { Metadata } from 'next';
import { FileText } from 'lucide-react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { ReportTable } from '@/components/reports/report-table';
import { Card, CardContent } from '@/components/ui/card';
import { requireCustomer } from '@/lib/auth';
import { listReports } from '@/lib/queries';

export const metadata: Metadata = { title: 'Service Reports' };

export default async function PortalReportsPage() {
  await requireCustomer();
  const { reports } = await listReports();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Service Reports"
        description="View and download signed service reports for your tickets."
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No service reports found"
          description="Service reports will appear here once an engineer completes and signs them off."
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <ReportTable reports={reports} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

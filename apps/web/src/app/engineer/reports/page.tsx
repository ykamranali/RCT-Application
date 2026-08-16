import type { Metadata } from 'next';
import { FileText } from 'lucide-react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { ReportTable } from '@/components/reports/report-table';
import { Card, CardContent } from '@/components/ui/card';
import { requireRole } from '@/lib/auth';
import { listReports } from '@/lib/queries';

export const metadata: Metadata = { title: 'My Service Reports' };

export default async function EngineerReportsPage() {
  await requireRole('engineer');
  const { reports } = await listReports();

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Service Reports"
        description="View signed service reports you have generated."
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No service reports found"
          description="Service reports you generate and sign off will appear here."
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

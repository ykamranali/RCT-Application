import type { Metadata } from 'next';

import { PageHeader } from '@/components/shell/page-header';
import { ExportCard } from '@/components/reports/export-card';
import { requireStaff } from '@/lib/auth';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsPage() {
  await requireStaff();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Reports & Exports"
        description="Generate and download data exports for tickets, contracts, and more."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <ExportCard 
          title="All Tickets" 
          description="Download a complete history of all tickets including their current SLA states, priority, and resolution details." 
          type="tickets" 
        />
        <ExportCard 
          title="AMC Contracts" 
          description="Download a list of all Annual Maintenance Contracts including their expiry dates and status." 
          type="amc" 
        />
      </div>
    </div>
  );
}

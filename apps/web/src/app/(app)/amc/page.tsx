import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, ShieldCheck } from 'lucide-react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { AmcTable } from '@/components/amc/amc-table';
import { AmcDialog } from '@/components/amc/amc-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { requireStaff } from '@/lib/auth';
import { listAmcs, getFormOptions, listSlaPlans } from '@/lib/queries';

export const metadata: Metadata = { title: 'AMC Contracts' };

export default async function AmcPage() {
  await requireStaff();

  const [amcsResult, options, slaPlans] = await Promise.all([
    listAmcs(),
    getFormOptions(),
    listSlaPlans()
  ]);

  const amcs = amcsResult.amcs;

  return (
    <div className="space-y-5">
      <PageHeader
        title="AMC Contracts"
        description="Manage Annual Maintenance Contracts and track expiry dates."
        actions={<AmcDialog customers={options.customers} slaPlans={slaPlans} />}
      />

      {amcs.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No contracts found"
          description="There are no active or expired contracts in the system."
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <AmcTable amcs={amcs} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

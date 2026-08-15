import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/shell/page-header';
import { AmcDialog } from '@/components/amc/amc-dialog';
import { requireStaff } from '@/lib/auth';
import { getAmc, getFormOptions, listSlaPlans } from '@/lib/queries';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const amc = await getAmc(resolvedParams.id);
  if (!amc) return { title: 'Contract Not Found' };
  return { title: amc.amc_number };
}

export default async function AmcDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const resolvedParams = await params;
  const amc = await getAmc(resolvedParams.id);

  if (!amc) notFound();

  const [options, slaPlans] = await Promise.all([
    getFormOptions(),
    listSlaPlans(),
  ]);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <PageHeader
        title={amc.amc_number}
        description={`Manage details for contract ${amc.amc_number}`}
        actions={<AmcDialog amc={amc} customers={options.customers} slaPlans={slaPlans} />}
      />
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Contract Details</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Type:</span> {amc.contract_type}</p>
            <p><span className="text-muted-foreground">Status:</span> {amc.status}</p>
            <p><span className="text-muted-foreground">Start Date:</span> {amc.start_date}</p>
            <p><span className="text-muted-foreground">Expiry Date:</span> {amc.expiry_date}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Commercials</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Value:</span> {amc.contract_value ? `${amc.contract_value} ${amc.currency}` : 'N/A'}</p>
            <p><span className="text-muted-foreground">Preventive Visits:</span> {amc.visits_included || 'N/A'}</p>
            <p><span className="text-muted-foreground">Notes:</span> {amc.notes || 'None'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

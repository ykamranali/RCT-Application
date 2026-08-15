import type { Metadata } from 'next';

import { PageHeader } from '@/components/shell/page-header';
import { CreateTicketForm } from '@/components/forms/create-ticket-form';
import { requireCustomer } from '@/lib/auth';
import { getBranchesForCustomer, getFormOptions } from '@/lib/queries';

export const metadata: Metadata = { title: 'Raise a complaint' };

export default async function NewComplaintPage() {
  const session = await requireCustomer();

  const [options, branches] = await Promise.all([
    getFormOptions(),
    session.profile.customer_id
      ? getBranchesForCustomer(session.profile.customer_id)
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Raise a complaint"
        description="Tell us what has gone wrong and we will dispatch an engineer."
      />

      <CreateTicketForm
        mode="customer"
        categories={options.categories.map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          defaultPriorityId: c.default_priority_id,
        }))}
        priorities={options.priorities.map((p: any) => ({ id: p.id, name: p.name, code: p.code }))}
        branches={branches.map((b: any) => ({ id: b.id, name: b.branch_name }))}
        defaultContactName={session.profile.full_name}
        defaultContactPhone={session.profile.phone}
        basePath="/portal/tickets"
      />
    </div>
  );
}

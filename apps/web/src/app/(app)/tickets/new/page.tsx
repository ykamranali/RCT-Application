import type { Metadata } from 'next';

import { CreateTicketForm } from '@/components/forms/create-ticket-form';
import { PageHeader } from '@/components/shell/page-header';
import { requireStaff } from '@/lib/auth';
import { getFormOptions } from '@/lib/queries';

export const metadata: Metadata = { title: 'New ticket' };

export default async function StaffNewTicketPage() {
  const session = await requireStaff();
  const options = await getFormOptions();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Log a new ticket" description="Raise a service request on behalf of a customer." />

      <CreateTicketForm
        mode="staff"
        categories={options.categories.map((c: any) => ({
          id: c.id, name: c.name, code: c.code, defaultPriorityId: c.default_priority_id,
        }))}
        priorities={options.priorities.map((p: any) => ({ id: p.id, name: p.name, code: p.code }))}
        customers={options.customers.map((c: any) => ({ id: c.id, name: c.company_name, code: c.customer_code }))}
        engineers={options.engineers.map((e: any) => ({ id: e.id, name: e.full_name, code: e.employee_code }))}
        defaultContactName={session.profile.full_name}
        basePath="/tickets"
      />
    </div>
  );
}

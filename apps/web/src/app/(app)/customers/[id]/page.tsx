import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/shell/page-header';
import { CustomerDialog } from '@/components/customers/customer-dialog';
import { requireStaff } from '@/lib/auth';
import { getCustomer } from '@/lib/queries';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const customer = await getCustomer(resolvedParams.id);
  if (!customer) return { title: 'Customer Not Found' };
  return { title: customer.company_name };
}

export default async function CustomerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const resolvedParams = await params;
  const customer = await getCustomer(resolvedParams.id);

  if (!customer) notFound();

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <PageHeader
        title={customer.company_name}
        description={`Manage details and contacts for ${customer.customer_code}`}
        actions={<CustomerDialog customer={customer} />}
      />
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Contact Information</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Person:</span> {customer.contact_person || 'N/A'}</p>
            <p><span className="text-muted-foreground">Email:</span> {customer.email || 'N/A'}</p>
            <p><span className="text-muted-foreground">Phone:</span> {customer.phone || 'N/A'}</p>
            <p><span className="text-muted-foreground">Alt Phone:</span> {customer.alternate_phone || 'N/A'}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Company Details</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Type:</span> {customer.customer_type}</p>
            <p><span className="text-muted-foreground">Status:</span> {customer.status}</p>
            <p><span className="text-muted-foreground">TRN:</span> {customer.tax_registration_no || 'N/A'}</p>
            <p><span className="text-muted-foreground">Licence:</span> {customer.trade_licence_no || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

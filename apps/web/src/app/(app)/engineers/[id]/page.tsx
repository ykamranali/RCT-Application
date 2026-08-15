import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/shell/page-header';
import { EngineerDialog } from '@/components/engineers/engineer-dialog';
import { requireStaff } from '@/lib/auth';
import { getEngineer } from '@/lib/queries';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const engineer = await getEngineer(resolvedParams.id);
  if (!engineer) return { title: 'Engineer Not Found' };
  return { title: engineer.full_name };
}

export default async function EngineerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const resolvedParams = await params;
  const engineer = await getEngineer(resolvedParams.id);

  if (!engineer) notFound();

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <PageHeader
        title={engineer.full_name}
        description={`Manage details for ${engineer.employee_code}`}
        actions={<EngineerDialog engineer={engineer} />}
      />
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Contact Information</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Email:</span> {engineer.email || 'N/A'}</p>
            <p><span className="text-muted-foreground">Phone:</span> {engineer.phone || 'N/A'}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Employment Details</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Job Title:</span> {engineer.job_title}</p>
            <p><span className="text-muted-foreground">Status:</span> {engineer.status}</p>
            <p><span className="text-muted-foreground">Max Open Tickets:</span> {engineer.max_open_tickets}</p>
            <p><span className="text-muted-foreground">Joining Date:</span> {engineer.joining_date || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

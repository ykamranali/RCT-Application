import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/shell/page-header';
import { PartDialog } from '@/components/parts/part-dialog';
import { requireStaff } from '@/lib/auth';
import { getPart } from '@/lib/queries';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const part = await getPart(resolvedParams.id);
  if (!part) return { title: 'Part Not Found' };
  return { title: part.name };
}

export default async function PartDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const resolvedParams = await params;
  const part = await getPart(resolvedParams.id);

  if (!part) notFound();

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <PageHeader
        title={part.name}
        description={`Manage details for part ${part.part_code}`}
        actions={<PartDialog part={part} />}
      />
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Part Information</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Description:</span> {part.description || 'N/A'}</p>
            <p><span className="text-muted-foreground">Status:</span> {part.is_active ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Pricing</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Unit:</span> {part.unit}</p>
            <p><span className="text-muted-foreground">Unit Cost:</span> {part.unit_cost ? `${part.unit_cost} ${part.currency}` : 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

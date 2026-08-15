import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Package } from 'lucide-react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { PartTable } from '@/components/parts/part-table';
import { PartDialog } from '@/components/parts/part-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireStaff } from '@/lib/auth';
import { listParts } from '@/lib/queries';

export const metadata: Metadata = { title: 'Spare Parts Inventory' };

export default async function PartsPage() {
  await requireStaff();

  const { parts } = await listParts();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parts Inventory"
        description="Manage catalogue of spare parts and components."
        actions={<PartDialog />}
      />

      {parts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No parts found"
          description="There are no spare parts in the inventory system."
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <PartTable parts={parts} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

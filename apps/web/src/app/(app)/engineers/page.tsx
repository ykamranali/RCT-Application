import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Wrench } from 'lucide-react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { EngineerTable } from '@/components/engineers/engineer-table';
import { EngineerDialog } from '@/components/engineers/engineer-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireStaff } from '@/lib/auth';
import { listEngineers } from '@/lib/queries';

export const metadata: Metadata = { title: 'Engineers' };

export default async function EngineersPage() {
  await requireStaff();

  const { engineers } = await listEngineers();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Engineers"
        description="Manage service engineers and field staff."
        actions={<EngineerDialog />}
      />

      {engineers.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No engineers found"
          description="You haven't added any engineers yet."
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <EngineerTable engineers={engineers} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Server } from 'lucide-react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { AssetTable } from '@/components/assets/asset-table';
import { AssetDialog } from '@/components/assets/asset-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { requireStaff } from '@/lib/auth';
import { listAssets, getFormOptions } from '@/lib/queries';

export const metadata: Metadata = { title: 'Asset Inventory' };

export default async function AssetsPage() {
  await requireStaff();

  const [assetsResult, options] = await Promise.all([
    listAssets(),
    getFormOptions()
  ]);

  const assets = assetsResult.assets;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Assets"
        description="Manage customer hardware and software inventory."
        actions={<AssetDialog customers={options.customers} />}
      />

      {assets.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No assets found"
          description="There are no assets registered in the system."
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <AssetTable assets={assets} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

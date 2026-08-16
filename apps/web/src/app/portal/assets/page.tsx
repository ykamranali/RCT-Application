import type { Metadata } from 'next';
import { Server } from 'lucide-react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { AssetTable } from '@/components/assets/asset-table';
import { Card, CardContent } from '@/components/ui/card';
import { requireCustomer } from '@/lib/auth';
import { listAssets } from '@/lib/queries';

export const metadata: Metadata = { title: 'Our Equipment' };

export default async function PortalAssetsPage() {
  await requireCustomer();
  const { assets } = await listAssets();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Our Equipment"
        description="View hardware and equipment registered under your company."
      />

      {assets.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No assets found"
          description="Your company doesn't have any registered equipment."
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <AssetTable assets={assets} hideActions hideCustomer />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

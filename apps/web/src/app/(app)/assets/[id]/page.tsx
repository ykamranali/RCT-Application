import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { PageHeader } from '@/components/shell/page-header';
import { AssetDialog } from '@/components/assets/asset-dialog';
import { requireStaff } from '@/lib/auth';
import { getAsset, getFormOptions } from '@/lib/queries';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const asset = await getAsset(resolvedParams.id);
  if (!asset) return { title: 'Asset Not Found' };
  return { title: asset.name };
}

export default async function AssetDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const resolvedParams = await params;
  const asset = await getAsset(resolvedParams.id);

  if (!asset) notFound();

  const options = await getFormOptions();

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <PageHeader
        title={asset.name}
        description={`Manage details for asset ${asset.asset_tag}`}
        actions={<AssetDialog asset={asset} customers={options.customers} />}
      />
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Hardware Details</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Manufacturer:</span> {asset.manufacturer || 'N/A'}</p>
            <p><span className="text-muted-foreground">Model:</span> {asset.model || 'N/A'}</p>
            <p><span className="text-muted-foreground">Serial Number:</span> {asset.serial_number || 'N/A'}</p>
            <p><span className="text-muted-foreground">Criticality:</span> {asset.criticality}</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Network & Lifecycle</h3>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">IP Address:</span> {asset.ip_address || 'N/A'}</p>
            <p><span className="text-muted-foreground">MAC Address:</span> {asset.mac_address || 'N/A'}</p>
            <p><span className="text-muted-foreground">Purchase Date:</span> {asset.purchase_date || 'N/A'}</p>
            <p><span className="text-muted-foreground">Warranty Expiry:</span> {asset.warranty_expiry || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Plus, Edit } from 'lucide-react';
import type { Asset } from '@rct/types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AssetForm } from '@/components/forms/asset-form';

export function AssetDialog({ 
  asset,
  customers,
}: { 
  asset?: Asset,
  customers: { id: string; company_name: string }[],
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {asset ? (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" /> New asset
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? 'Edit Asset' : 'New Asset'}</DialogTitle>
          <DialogDescription>
            {asset ? 'Update hardware or software asset details.' : 'Register a new hardware or software asset into inventory.'}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <AssetForm initialData={asset} customers={customers} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

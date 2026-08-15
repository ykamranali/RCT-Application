'use client';

import { useState } from 'react';
import { Plus, Edit } from 'lucide-react';
import type { AmcContract } from '@rct/types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AmcForm } from '@/components/forms/amc-form';

export function AmcDialog({ 
  amc,
  customers,
  slaPlans
}: { 
  amc?: AmcContract,
  customers: { id: string; company_name: string }[],
  slaPlans: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {amc ? (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" /> New contract
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{amc ? 'Edit Contract' : 'New Contract'}</DialogTitle>
          <DialogDescription>
            {amc ? 'Update contract details below.' : 'Register a new Annual Maintenance Contract.'}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <AmcForm initialData={amc} customers={customers} slaPlans={slaPlans} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

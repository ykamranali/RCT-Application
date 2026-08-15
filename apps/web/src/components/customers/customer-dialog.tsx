'use client';

import { useState } from 'react';
import { Plus, Edit } from 'lucide-react';
import type { Customer } from '@rct/types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CustomerForm } from '@/components/forms/customer-form';

export function CustomerDialog({ customer }: { customer?: Customer }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {customer ? (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" /> New customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{customer ? 'Edit Customer' : 'New Customer'}</DialogTitle>
          <DialogDescription>
            {customer ? 'Update customer details below.' : 'Register a new customer company or organization.'}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <CustomerForm initialData={customer} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

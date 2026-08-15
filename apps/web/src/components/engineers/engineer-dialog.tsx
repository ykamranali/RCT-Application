'use client';

import { useState } from 'react';
import { Plus, Edit } from 'lucide-react';
import type { Employee } from '@rct/types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EngineerForm } from '@/components/forms/engineer-form';

export function EngineerDialog({ engineer }: { engineer?: Employee }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {engineer ? (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" /> New engineer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{engineer ? 'Edit Engineer' : 'New Engineer'}</DialogTitle>
          <DialogDescription>
            {engineer ? 'Update engineer details below.' : 'Add a new service engineer or field staff.'}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <EngineerForm initialData={engineer} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

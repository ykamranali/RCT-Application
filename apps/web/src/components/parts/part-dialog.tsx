'use client';

import { useState } from 'react';
import { Plus, Edit } from 'lucide-react';
import type { PartCatalogue } from '@rct/types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PartForm } from '@/components/forms/part-form';

export function PartDialog({ part }: { part?: PartCatalogue }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {part ? (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" /> New part
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{part ? 'Edit Part' : 'New Part'}</DialogTitle>
          <DialogDescription>
            {part ? 'Update part details and pricing.' : 'Add a new component or spare part to the inventory.'}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <PartForm initialData={part} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

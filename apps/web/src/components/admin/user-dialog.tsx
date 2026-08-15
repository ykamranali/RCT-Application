'use client';

import { useState } from 'react';
import { Plus, Edit } from 'lucide-react';
import type { Profile } from '@rct/types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UserForm } from '@/components/forms/user-form';

export function UserDialog({ user, asChild }: { user?: Profile; asChild?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {asChild ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Edit user</span>
          </Button>
        ) : user ? (
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" /> Edit
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Invite user
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{user ? 'Edit User' : 'Invite User'}</DialogTitle>
          <DialogDescription>
            {user ? 'Update access and roles for this user.' : 'Create a new user account.'}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <UserForm initialData={user} onSuccess={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

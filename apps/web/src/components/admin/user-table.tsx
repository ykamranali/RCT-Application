'use client';

import { Users, Shield, ShieldAlert, BadgeInfo, Trash } from 'lucide-react';
import type { Profile } from '@rct/types';
import { UserDialog } from '@/components/admin/user-dialog';
import { deleteUser } from '@/lib/actions/users';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function UserTable({ users }: { users: Profile[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    {u.role.includes('admin') ? (
                      <ShieldAlert className="h-5 w-5" />
                    ) : u.role.includes('manager') ? (
                      <Shield className="h-5 w-5" />
                    ) : u.role === 'customer_user' ? (
                      <BadgeInfo className="h-5 w-5" />
                    ) : (
                      <Users className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <span className="font-medium">
                      {u.full_name}
                    </span>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {u.role.replace('_', ' ').toLowerCase()}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={u.is_active ? 'default' : 'neutral'}
                  className={cn(
                    'capitalize',
                    u.is_active ? 'bg-success text-success-foreground' : ''
                  )}
                >
                  {u.is_active ? 'Active' : 'Disabled'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <UserDialog user={u} asChild />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger hover:text-danger hover:bg-danger/10"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                        await deleteUser(u.id);
                      }
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

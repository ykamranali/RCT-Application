import type { Metadata } from 'next';
import { Users } from 'lucide-react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { UserTable } from '@/components/admin/user-table';
import { UserDialog } from '@/components/admin/user-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { requireAdmin } from '@/lib/auth';
import { listUsers } from '@/lib/queries';

export const metadata: Metadata = { title: 'User Management' };

export default async function AdminUsersPage() {
  await requireAdmin();

  const { users } = await listUsers();

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Management"
        description="Manage access and roles for all staff and customers."
        actions={<UserDialog />}
      />

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users found"
          description="There are no users in the system."
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <UserTable users={users} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

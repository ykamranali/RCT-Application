import type { Metadata } from 'next';
import { Bell } from 'lucide-react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { requireSession } from '@/lib/auth';
import { listNotifications } from '@/lib/queries';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const session = await requireSession();
  const { notifications } = await listNotifications(session.profile.id);

  async function markAllAsRead() {
    'use server';
    const supabase = await createServerSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('profile_id', session.user.id)
      .is('read_at', null);
      
    revalidatePath('/notifications');
  }

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <PageHeader
        title="Notifications"
        description={`You have ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}.`}
        actions={
          unreadCount > 0 ? (
            <form action={markAllAsRead}>
              <Button type="submit" variant="outline">Mark all as read</Button>
            </form>
          ) : null
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="You don't have any notifications at the moment."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <Card key={n.id} className={cn(!n.read_at && 'border-primary/50 bg-primary/5')}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className={cn("font-medium", !n.read_at && 'text-primary')}>{n.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                {n.link_url && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={n.link_url}>View</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';

import type { AppNotification } from '@rct/types';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelative } from '@/lib/format';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const SEVERITY_DOT = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-danger',
} as const;

export function NotificationBell({ initialUnread = 0 }: { initialUnread?: number }) {
  const router = useRouter();
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(12);
      const rows = (data as AppNotification[] | null) ?? [];
      setItems(rows);
      setUnread(rows.filter((n) => !n.read_at).length);
    } finally {
      setLoading(false);
    }
  }, []);

  // Live updates. RLS restricts the stream to this user's own rows, so no
  // filter is needed here for correctness - only for efficiency.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel('notification-bell')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setItems((prev) => [payload.new as AppNotification, ...prev].slice(0, 12));
        setUnread((n) => n + 1);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function markAllRead() {
    const supabase = createBrowserSupabase();
    await supabase.rpc('mark_notifications_read', { p_ids: null });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    router.refresh();
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="tabular absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-2xs font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void markAllRead()}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-[22rem] overflow-y-auto scrollbar-thin">
          {loading && items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">You are all caught up.</p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.link_url ?? '#'}
                    className={cn('flex gap-2.5 px-3 py-2.5 transition-colors hover:bg-accent', !item.read_at && 'bg-primary/[0.04]')}
                  >
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', SEVERITY_DOT[item.severity] ?? 'bg-muted-foreground')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      {item.body ? (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>
                      ) : null}
                      <span className="mt-1 block text-2xs text-muted-foreground">{formatRelative(item.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t p-1">
          <Button asChild variant="ghost" size="sm" className="w-full justify-center text-xs">
            <Link href="/notifications">View all notifications</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

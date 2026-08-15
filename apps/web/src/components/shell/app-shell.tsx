import type { ReactNode } from 'react';

import type { Profile } from '@rct/types';

import { GlobalSearch } from './global-search';
import { NotificationBell } from './notification-bell';
import { Sidebar, type SidebarCounts } from './sidebar';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

/**
 * Application chrome for every signed-in route: fixed sidebar on desktop,
 * off-canvas drawer on mobile, sticky frosted top bar.
 */
export function AppShell({
  profile,
  counts,
  children,
}: {
  profile: Profile;
  counts: SidebarCounts;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="lg:pl-[260px]">
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 sm:px-6">
          {/*
            Sidebar renders its own mobile trigger inline plus a `fixed`
            drawer, so mounting it here puts the hamburger in the top bar
            while the panel still positions against the viewport.
          */}
          <Sidebar role={profile.role} counts={counts} />
          <div className="flex-1">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell initialUnread={counts.unread ?? 0} />
            <UserMenu profile={profile} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

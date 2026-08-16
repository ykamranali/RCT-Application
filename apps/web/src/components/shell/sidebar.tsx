'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

import { BRANDING, type UserRole } from '@rct/types';

import { Button } from '@/components/ui/button';
import { InstallPrompt } from '@/components/shell/install-prompt';
import { homeHref, navigationForRole } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export interface SidebarCounts {
  openTickets?: number;
  unread?: number;
  breached?: number;
}

export function Sidebar({ role, counts }: { role: UserRole; counts: SidebarCounts }) {
  const [open, setOpen] = useState(false);
  const sections = navigationForRole(role);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile trigger lives in the top bar's flow on small screens */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link href={homeHref(role)} className="flex items-center gap-2.5 rounded-md">
            <Wordmark />
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-muted hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto scrollbar-thin px-3 py-4" aria-label="Main">
          {sections.map((section, i) => (
            <div key={section.label ?? i}>
              {section.label ? (
                <p className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-sidebar-muted">
                  {section.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const count = item.badgeKey ? counts[item.badgeKey] : undefined;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-white/10 text-white'
                            : 'text-sidebar-muted hover:bg-white/[0.06] hover:text-white',
                        )}
                      >
                        <item.icon
                          className={cn('h-4 w-4 shrink-0', active ? 'text-sidebar-accent' : '')}
                          aria-hidden
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {count ? (
                          <span
                            className={cn(
                              'tabular rounded-full px-1.5 py-0.5 text-2xs font-semibold',
                              item.badgeKey === 'breached'
                                ? 'bg-danger text-white'
                                : 'bg-white/12 text-white',
                            )}
                          >
                            {count > 99 ? '99+' : count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <InstallPrompt />

        <div className="border-t border-sidebar-border px-4 py-3">
          <p className="text-2xs leading-relaxed text-sidebar-muted">
            {BRANDING.companyName}
          </p>
        </div>
      </aside>
    </>
  );
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/logo.png" alt="RCT Logo" className="h-10 object-contain drop-shadow-sm" />
    </span>
  );
}

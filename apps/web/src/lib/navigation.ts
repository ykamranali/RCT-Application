import {
  Activity, BarChart3, Bell, Boxes, Building2, ClipboardList, Cog, FileText,
  Gauge, HardDrive, LayoutDashboard, LifeBuoy, MessageSquare, Package, ScrollText,
  ShieldCheck, Ticket, UserCog, Users, Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { isAdmin, isCustomer, isManagement, type UserRole } from '@rct/types';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Rendered as a count chip; resolved server-side. */
  badgeKey?: 'openTickets' | 'unread' | 'breached';
  exact?: boolean;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

/**
 * Navigation is derived from the role rather than rendered-then-hidden, so a
 * customer never receives markup for an admin route. The routes themselves
 * re-check permissions server-side and RLS backs that up.
 */
export function navigationForRole(role: UserRole): NavSection[] {
  if (isCustomer(role)) {
    return [
      {
        items: [
          { label: 'Overview', href: '/portal', icon: LayoutDashboard, exact: true },
          { label: 'My tickets', href: '/portal/tickets', icon: Ticket, badgeKey: 'openTickets' },
          { label: 'Raise a complaint', href: '/portal/tickets/new', icon: MessageSquare },
          { label: 'Service reports', href: '/portal/reports', icon: FileText },
          { label: 'Our equipment', href: '/portal/assets', icon: HardDrive },
        ],
      },
      {
        label: 'Account',
        items: [
          { label: 'Notifications', href: '/portal/notifications', icon: Bell, badgeKey: 'unread' },
          { label: 'Profile', href: '/profile', icon: UserCog },
        ],
      },
    ];
  }

  if (role === 'engineer') {
    return [
      {
        items: [
          { label: 'My day', href: '/engineer', icon: Gauge, exact: true },
          { label: 'My tickets', href: '/engineer/tickets', icon: Ticket, badgeKey: 'openTickets' },
          { label: 'Schedule', href: '/engineer/schedule', icon: ClipboardList },
          { label: 'Service reports', href: '/engineer/reports', icon: FileText },
        ],
      },
      {
        label: 'Reference',
        items: [
          { label: 'Customers', href: '/customers', icon: Building2 },
          { label: 'Assets', href: '/assets', icon: HardDrive },
          { label: 'Notifications', href: '/notifications', icon: Bell, badgeKey: 'unread' },
          { label: 'Profile', href: '/profile', icon: UserCog },
        ],
      },
    ];
  }

  const sections: NavSection[] = [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
        { label: 'Tickets', href: '/tickets', icon: Ticket, badgeKey: 'openTickets' },
        { label: 'SLA monitor', href: '/sla', icon: Activity, badgeKey: 'breached' },
      ],
    },
    {
      label: 'Service delivery',
      items: [
        { label: 'Customers', href: '/customers', icon: Building2 },
        { label: 'Engineers', href: '/engineers', icon: Wrench },
        { label: 'AMC contracts', href: '/amc', icon: ShieldCheck },
        { label: 'Assets', href: '/assets', icon: HardDrive },
        { label: 'Parts', href: '/parts', icon: Package },
      ],
    },
    {
      label: 'Insight',
      items: [
        { label: 'Analytics', href: '/analytics', icon: BarChart3 },
        { label: 'Reports', href: '/reports', icon: FileText },
      ],
    },
  ];

  if (isAdmin(role)) {
    sections.push({
      label: 'Administration',
      items: [
        { label: 'Users', href: '/admin/users', icon: Users },
        { label: 'Settings', href: '/admin/settings', icon: Cog },
        { label: 'Email templates', href: '/admin/email', icon: MessageSquare },
        { label: 'Service catalogue', href: '/admin/catalogue', icon: Boxes },
        { label: 'Audit log', href: '/admin/audit', icon: ScrollText },
      ],
    });
  } else if (isManagement(role)) {
    sections.push({
      label: 'Administration',
      items: [{ label: 'Audit log', href: '/admin/audit', icon: ScrollText }],
    });
  }

  sections.push({
    label: 'Account',
    items: [
      { label: 'Notifications', href: '/notifications', icon: Bell, badgeKey: 'unread' },
      { label: 'Profile', href: '/profile', icon: UserCog },
      { label: 'Help', href: '/help', icon: LifeBuoy },
    ],
  });

  return sections;
}

/** Root path for the role, used by the logo link and breadcrumbs. */
export function homeHref(role: UserRole): string {
  if (isCustomer(role)) return '/portal';
  if (role === 'engineer') return '/engineer';
  return '/dashboard';
}

'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { Search, X } from 'lucide-react';

import { TICKET_STATUSES, TICKET_STATUS_META } from '@rct/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export interface FilterOption { id: string; label: string }

/**
 * Filters are held in the URL rather than component state, so a filtered
 * view can be bookmarked, shared with a colleague, or reloaded without
 * losing the selection.
 */
export function TicketFilters({
  customers = [],
  engineers = [],
  categories = [],
  showCustomer = true,
  showEngineer = true,
}: {
  customers?: FilterOption[];
  engineers?: FilterOption[];
  categories?: FilterOption[];
  showCustomer?: boolean;
  showEngineer?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get('q') ?? '');

  const apply = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || value === 'all') next.delete(key);
        else next.set(key, value);
      }
      next.delete('page');
      startTransition(() => router.push(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router],
  );

  const active = ['status', 'priority', 'customer', 'engineer', 'category', 'sla', 'q'].filter((k) =>
    params.get(k),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative min-w-[16rem] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ q: search });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket number, subject or customer…"
            className="pl-9"
            aria-label="Search tickets"
          />
        </form>

        <Select value={params.get('status') ?? 'all'} onValueChange={(v) => apply({ status: v })}>
          <SelectTrigger className="w-[170px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open only</SelectItem>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{TICKET_STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={params.get('priority') ?? 'all'} onValueChange={(v) => apply({ priority: v })}>
          <SelectTrigger className="w-[140px]" aria-label="Filter by priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={params.get('sla') ?? 'all'} onValueChange={(v) => apply({ sla: v })}>
          <SelectTrigger className="w-[140px]" aria-label="Filter by SLA state">
            <SelectValue placeholder="SLA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any SLA state</SelectItem>
            <SelectItem value="met">On track</SelectItem>
            <SelectItem value="at_risk">At risk</SelectItem>
            <SelectItem value="breached">Breached</SelectItem>
          </SelectContent>
        </Select>

        {showCustomer && customers.length > 0 ? (
          <Select value={params.get('customer') ?? 'all'} onValueChange={(v) => apply({ customer: v })}>
            <SelectTrigger className="w-[190px]" aria-label="Filter by customer">
              <SelectValue placeholder="Customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {showEngineer && engineers.length > 0 ? (
          <Select value={params.get('engineer') ?? 'all'} onValueChange={(v) => apply({ engineer: v })}>
            <SelectTrigger className="w-[180px]" aria-label="Filter by engineer">
              <SelectValue placeholder="Engineer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All engineers</SelectItem>
              {engineers.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {categories.length > 0 ? (
          <Select value={params.get('category') ?? 'all'} onValueChange={(v) => apply({ category: v })}>
            <SelectTrigger className="w-[170px]" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {active.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              startTransition(() => router.push(pathname));
            }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      {pending ? <p className="text-xs text-muted-foreground">Updating…</p> : null}
    </div>
  );
}

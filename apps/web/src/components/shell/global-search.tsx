'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, FileText, HardDrive, Loader2, Search, ShieldCheck, Ticket, Wrench } from 'lucide-react';

import type { SearchResult } from '@rct/types';

import { createBrowserSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const ICONS = {
  ticket: Ticket,
  customer: Building2,
  engineer: Wrench,
  asset: HardDrive,
  amc: ShieldCheck,
  service_report: FileText,
} as const;

const KIND_LABELS = {
  ticket: 'Ticket',
  customer: 'Customer',
  engineer: 'Engineer',
  asset: 'Asset',
  amc: 'Contract',
  service_report: 'Report',
} as const;

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cmd/Ctrl+K focuses the field, as in every other tool the team uses.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const run = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.rpc('global_search', { p_query: term.trim(), p_limit: 6 });
      setResults((data as SearchResult[] | null) ?? []);
      setHighlight(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce so a fast typist does not fire a query per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => void run(query), 220);
    return () => clearTimeout(handle);
  }, [query, run]);

  function go(result: SearchResult) {
    setOpen(false);
    setQuery('');
    router.push(result.url);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <label htmlFor="global-search" className="sr-only">
        Search tickets, customers, engineers and assets
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="global-search"
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter' && results[highlight]) {
              e.preventDefault();
              go(results[highlight]);
            }
          }}
          placeholder="Search tickets, customers, assets…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-14 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-results"
          aria-autocomplete="list"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground sm:block">
          ⌘K
        </kbd>
        {loading ? (
          <Loader2 className="absolute right-9 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </div>

      {open && query.trim().length >= 2 ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border bg-popover shadow-float"
        >
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {loading ? 'Searching…' : `Nothing found for “${query}”`}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto scrollbar-thin py-1">
              {results.map((result, index) => {
                const Icon = ICONS[result.kind] ?? Ticket;
                return (
                  <li key={`${result.kind}-${result.id}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === highlight}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => go(result)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-left text-sm',
                        index === highlight ? 'bg-accent' : '',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{result.label}</span>
                        {result.sublabel ? (
                          <span className="block truncate text-xs text-muted-foreground">{result.sublabel}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                        {KIND_LABELS[result.kind]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

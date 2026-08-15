import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  href?: string;
  /** Percentage change against the previous period. */
  delta?: number | null;
}

const TONES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

const ICON_TONES: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', href, delta }: StatCardProps) {
  const body = (
    <div
      className={cn(
        'group relative flex h-full flex-col justify-between gap-3 rounded-lg border bg-card p-4 shadow-card transition-all',
        href && 'hover:-translate-y-0.5 hover:shadow-raised focus-visible:-translate-y-0.5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? (
          <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-md', ICON_TONES[tone])}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>

      <div>
        <p className={cn('tabular text-2xl font-semibold leading-none tracking-tight', TONES[tone])}>{value}</p>
        <div className="mt-1.5 flex items-center gap-2">
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          {typeof delta === 'number' && Number.isFinite(delta) ? (
            <span
              className={cn(
                'tabular text-xs font-medium',
                delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-muted-foreground',
              )}
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="rounded-lg focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

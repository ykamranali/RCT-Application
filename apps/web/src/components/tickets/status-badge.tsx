import {
  SLA_STATE_META,
  TICKET_STATUS_META,
  type SlaState,
  type TicketStatus,
} from '@rct/types';

import { cn } from '@/lib/utils';

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  const meta = TICKET_STATUS_META[status];
  return (
    <span className={cn('chip', meta.className, className)}>
      {meta.isPaused ? <PauseGlyph /> : null}
      {meta.label}
    </span>
  );
}

/**
 * SLA indicator. Green / amber / red per the specification, with the state
 * also carried in text so the meaning does not depend on colour alone.
 */
export function SlaBadge({
  state,
  remainingMinutes,
  paused,
  className,
}: {
  state: SlaState;
  remainingMinutes?: number | null;
  paused?: boolean;
  className?: string;
}) {
  const meta = SLA_STATE_META[state];
  const overdue = typeof remainingMinutes === 'number' && remainingMinutes < 0;

  return (
    <span className={cn('chip', meta.className, state === 'breached' && 'animate-pulse-ring', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
      {paused ? 'Paused' : meta.label}
      {typeof remainingMinutes === 'number' && !paused ? (
        <span className="tabular opacity-80">
          · {overdue ? '-' : ''}
          {formatShort(Math.abs(remainingMinutes))}
        </span>
      ) : null}
    </span>
  );
}

export function PriorityBadge({
  code,
  name,
  colour,
  className,
}: {
  code: string | null;
  name?: string | null;
  colour?: string | null;
  className?: string;
}) {
  if (!code) return <span className="text-xs text-muted-foreground">—</span>;
  const tint = colour ?? '#64748b';
  return (
    <span
      className={cn('chip', className)}
      style={{ backgroundColor: `${tint}1a`, color: tint, boxShadow: `inset 0 0 0 1px ${tint}40` }}
    >
      {name ?? code}
    </span>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 8 8" className="h-2 w-2" aria-hidden fill="currentColor">
      <rect x="0.5" y="0" width="2.5" height="8" rx="0.6" />
      <rect x="5" y="0" width="2.5" height="8" rx="0.6" />
    </svg>
  );
}

/** Compact duration for a badge: 2d, 5h, 40m. */
function formatShort(minutes: number): string {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes)}m`;
}

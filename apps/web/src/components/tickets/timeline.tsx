import {
  CheckCircle2, CircleDot, FileText, MessageSquare, PenLine, RotateCcw,
  Star, TriangleAlert, UserCheck, XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { TICKET_STATUS_META, type TicketStatusHistory } from '@rct/types';

import { formatTimelineStamp } from '@/lib/format';
import { cn } from '@/lib/utils';

const EVENT_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  created: { icon: CircleDot, tone: 'bg-info-soft text-info ring-info/25' },
  assignment: { icon: UserCheck, tone: 'bg-primary/10 text-primary ring-primary/25' },
  assigned: { icon: UserCheck, tone: 'bg-primary/10 text-primary ring-primary/25' },
  status_change: { icon: CircleDot, tone: 'bg-muted text-muted-foreground ring-border' },
  sla_warning: { icon: TriangleAlert, tone: 'bg-warning-soft text-warning ring-warning/25' },
  sla_breach: { icon: TriangleAlert, tone: 'bg-danger-soft text-danger ring-danger/25' },
  service_report: { icon: FileText, tone: 'bg-success-soft text-success ring-success/25' },
  feedback: { icon: Star, tone: 'bg-success-soft text-success ring-success/25' },
  approval: { icon: CheckCircle2, tone: 'bg-success-soft text-success ring-success/25' },
  rejection: { icon: XCircle, tone: 'bg-danger-soft text-danger ring-danger/25' },
  comment: { icon: MessageSquare, tone: 'bg-muted text-muted-foreground ring-border' },
  signature: { icon: PenLine, tone: 'bg-primary/10 text-primary ring-primary/25' },
  reopen: { icon: RotateCcw, tone: 'bg-danger-soft text-danger ring-danger/25' },
};

/** Vertical ticket history, oldest first. */
export function Timeline({ events }: { events: TicketStatusHistory[] }) {
  if (events.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-0" aria-label="Ticket history">
      {events.map((event, index) => {
        const style = EVENT_STYLE[event.event_type] ?? EVENT_STYLE.status_change;
        const Icon = style.icon;
        const last = index === events.length - 1;

        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? (
              <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border" aria-hidden />
            ) : null}

            <span className={cn('relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ring-inset', style.tone)}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm">
                <span className="font-medium">{describe(event)}</span>
                {event.changed_by_name ? (
                  <span className="text-muted-foreground"> · {event.changed_by_name}</span>
                ) : null}
              </p>
              {event.note ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{event.note}</p>
              ) : null}
              <time
                className="mt-1 block text-2xs text-muted-foreground"
                dateTime={event.created_at}
              >
                {formatTimelineStamp(event.created_at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function describe(event: TicketStatusHistory): string {
  switch (event.event_type) {
    case 'created':
      return 'Ticket created';
    case 'assignment':
    case 'assigned':
      return event.note ?? 'Engineer assigned';
    case 'sla_warning':
      return 'SLA at risk';
    case 'sla_breach':
      return 'SLA breached';
    case 'service_report':
      return 'Service report issued';
    case 'feedback':
      return 'Customer feedback received';
    case 'approval':
      return 'Work confirmed by customer';
    case 'rejection':
      return 'Work rejected by customer';
    default:
      return event.from_status
        ? `${TICKET_STATUS_META[event.from_status].label} → ${TICKET_STATUS_META[event.to_status].label}`
        : TICKET_STATUS_META[event.to_status].label;
  }
}

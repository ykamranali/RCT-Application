import Link from 'next/link';
import { Paperclip, MessageSquare } from 'lucide-react';

import type { TicketOverview } from '@rct/types';

import { PriorityBadge, SlaBadge, StatusBadge } from '@/components/tickets/status-badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatRelative } from '@/lib/format';

/**
 * Ticket list. Desktop gets a dense table; below `md` the same rows render
 * as cards, because a horizontally scrolling table is unusable on a phone
 * and engineers read this screen on site.
 */
export function TicketTable({
  tickets,
  basePath = '/tickets',
  showCustomer = true,
  showEngineer = true,
}: {
  tickets: TicketOverview[];
  basePath?: string;
  showCustomer?: boolean;
  showEngineer?: boolean;
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[132px]">Ticket</TableHead>
              <TableHead>Subject</TableHead>
              {showCustomer ? <TableHead className="w-[180px]">Customer</TableHead> : null}
              <TableHead className="w-[104px]">Priority</TableHead>
              <TableHead className="w-[132px]">Status</TableHead>
              <TableHead className="w-[150px]">SLA</TableHead>
              {showEngineer ? <TableHead className="w-[150px]">Engineer</TableHead> : null}
              <TableHead className="w-[130px]">Raised</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id} className="cursor-pointer">
                <TableCell>
                  <Link href={`${basePath}/${ticket.id}`} className="tabular font-mono text-xs font-medium text-primary hover:underline">
                    {ticket.ticket_number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`${basePath}/${ticket.id}`} className="block max-w-[26rem]">
                    <span className="block truncate font-medium">{ticket.subject}</span>
                    <span className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
                      {ticket.category_name ? <span className="truncate">{ticket.category_name}</span> : null}
                      {ticket.public_comment_count > 0 ? (
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{ticket.public_comment_count}</span>
                      ) : null}
                      {ticket.attachment_count > 0 ? (
                        <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{ticket.attachment_count}</span>
                      ) : null}
                    </span>
                  </Link>
                </TableCell>
                {showCustomer ? (
                  <TableCell>
                    <span className="block max-w-[11rem] truncate text-sm">{ticket.customer_name}</span>
                    {ticket.branch_name ? (
                      <span className="block max-w-[11rem] truncate text-xs text-muted-foreground">{ticket.branch_name}</span>
                    ) : null}
                  </TableCell>
                ) : null}
                <TableCell>
                  <PriorityBadge code={ticket.priority_code} name={ticket.priority_name} colour={ticket.priority_colour} />
                </TableCell>
                <TableCell><StatusBadge status={ticket.status} /></TableCell>
                <TableCell>
                  <SlaBadge
                    state={ticket.resolution_state}
                    remainingMinutes={ticket.resolution_remaining_minutes}
                    paused={ticket.sla_paused}
                  />
                </TableCell>
                {showEngineer ? (
                  <TableCell>
                    <span className="block max-w-[9rem] truncate text-sm">
                      {ticket.engineer_name ?? <span className="text-muted-foreground">Unassigned</span>}
                    </span>
                  </TableCell>
                ) : null}
                <TableCell>
                  <span className="block text-xs text-muted-foreground" title={formatDateTime(ticket.created_at)}>
                    {formatRelative(ticket.created_at)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2.5 md:hidden">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link href={`${basePath}/${ticket.id}`} className="block rounded-lg border bg-card p-3 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <span className="tabular font-mono text-xs font-medium text-primary">{ticket.ticket_number}</span>
                <PriorityBadge code={ticket.priority_code} name={ticket.priority_name} colour={ticket.priority_colour} />
              </div>
              <p className="mt-1.5 line-clamp-2 text-sm font-medium">{ticket.subject}</p>
              {showCustomer ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {ticket.customer_name}{ticket.branch_name ? ` · ${ticket.branch_name}` : ''}
                </p>
              ) : null}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={ticket.status} />
                <SlaBadge
                  state={ticket.resolution_state}
                  remainingMinutes={ticket.resolution_remaining_minutes}
                  paused={ticket.sla_paused}
                />
              </div>
              <p className="mt-2 text-2xs text-muted-foreground">
                Raised {formatRelative(ticket.created_at)}
                {ticket.engineer_name ? ` · ${ticket.engineer_name}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

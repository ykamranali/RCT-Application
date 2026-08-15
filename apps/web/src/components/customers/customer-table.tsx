'use client';

import Link from 'next/link';

import type { CustomerSummary } from '@rct/types';
import { Building2, Edit, Trash } from 'lucide-react';
import { deleteCustomer } from '@/lib/actions/customers';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CustomerTable({ customers }: { customers: CustomerSummary[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tickets</TableHead>
            <TableHead>Open</TableHead>
            <TableHead>Assets</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow key={c.customer_id} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <Link
                      href={`/customers/${c.customer_id}`}
                      className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {c.company_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.customer_code}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize">
                  {c.customer_type.replace('_', ' ').toLowerCase()}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={c.status === 'active' ? 'default' : 'neutral'}
                  className={cn(
                    'capitalize',
                    c.status === 'active' ? 'bg-success text-success-foreground' : ''
                  )}
                >
                  {c.status}
                </Badge>
              </TableCell>
              <TableCell className="tabular">{c.total_tickets.toLocaleString()}</TableCell>
              <TableCell className="tabular">
                {c.open_tickets > 0 ? (
                  <span className="inline-flex h-6 items-center rounded-full bg-warning-soft px-2.5 text-xs font-medium text-warning">
                    {c.open_tickets}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="tabular">{c.asset_count.toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/customers/${c.customer_id}`}><Edit className="h-4 w-4" /></Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger hover:text-danger hover:bg-danger/10"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
                        await deleteCustomer(c.customer_id);
                      }
                    }}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

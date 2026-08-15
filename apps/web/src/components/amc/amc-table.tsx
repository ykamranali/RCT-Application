'use client';

import Link from 'next/link';
import { FileSignature, Edit, Trash } from 'lucide-react';
import type { AmcExpiring } from '@rct/types';
import { deleteAmc } from '@/lib/actions/amc';

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

export function AmcTable({ amcs }: { amcs: AmcExpiring[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead>Contract</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expiry Date</TableHead>
            <TableHead className="text-right">Days Left</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {amcs.map((a) => (
            <TableRow key={a.id} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileSignature className="h-5 w-5" />
                  </div>
                  <div>
                    <Link
                      href={`/amc/${a.id}`}
                      className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {a.amc_number}
                    </Link>
                    <p className="text-xs text-muted-foreground">{a.contract_type}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {a.company_name}
              </TableCell>
              <TableCell>
                <Badge
                  variant={a.status === 'ACTIVE' ? 'default' : 'neutral'}
                  className={cn(
                    'capitalize',
                    a.status === 'ACTIVE' ? 'bg-success text-success-foreground' : ''
                  )}
                >
                  {a.status}
                </Badge>
              </TableCell>
              <TableCell>
                {a.expiry_date}
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant={a.days_remaining < 30 ? 'danger' : 'neutral'}
                  className={cn(
                    a.days_remaining > 30 ? 'bg-success text-success-foreground' : ''
                  )}
                >
                  {a.days_remaining > 0 ? `${a.days_remaining} days` : 'Expired'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/amc/${a.id}`}><Edit className="h-4 w-4" /></Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger hover:text-danger hover:bg-danger/10"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this contract? This action cannot be undone.')) {
                        await deleteAmc(a.id);
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

'use client';

import Link from 'next/link';

import type { Employee } from '@rct/types';
import { Wrench, Edit, Trash } from 'lucide-react';
import { deleteEngineer } from '@/lib/actions/engineers';

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

export function EngineerTable({ engineers }: { engineers: Employee[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead>Engineer</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Max Tickets</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {engineers.map((e) => (
            <TableRow key={e.id} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div>
                    <Link
                      href={`/engineers/${e.id}`}
                      className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {e.full_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{e.employee_code}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div>{e.email}</div>
                  <div className="text-muted-foreground">{e.phone || '-'}</div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={e.status === 'active' ? 'default' : 'neutral'}
                  className={cn(
                    'capitalize',
                    e.status === 'active' ? 'bg-success text-success-foreground' : ''
                  )}
                >
                  {e.status}
                </Badge>
              </TableCell>
              <TableCell className="tabular">
                {e.max_open_tickets}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/engineers/${e.id}`}><Edit className="h-4 w-4" /></Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger hover:text-danger hover:bg-danger/10"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this engineer? This action cannot be undone.')) {
                        await deleteEngineer(e.id);
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

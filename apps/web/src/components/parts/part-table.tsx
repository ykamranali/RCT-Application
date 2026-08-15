'use client';

import Link from 'next/link';
import { Package, Edit, Trash } from 'lucide-react';
import type { PartCatalogue } from '@rct/types';
import { deletePart } from '@/lib/actions/parts';

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

export function PartTable({ parts }: { parts: PartCatalogue[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead>Part / Component</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Unit Cost</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parts.map((p) => {
            return (
              <TableRow key={p.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <Link
                        href={`/parts/${p.id}`}
                        className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground font-mono">{p.part_code}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm truncate max-w-[300px]" title={p.description || ''}>
                    {p.description || '-'}
                  </p>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={p.is_active ? 'default' : 'neutral'}
                    className={cn(
                      'capitalize',
                      p.is_active ? 'bg-success text-success-foreground' : ''
                    )}
                  >
                    {p.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className="tabular font-medium">
                    {p.unit_cost !== null ? `${p.unit_cost} ${p.currency}` : '-'}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    / {p.unit}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/parts/${p.id}`}><Edit className="h-4 w-4" /></Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-danger hover:text-danger hover:bg-danger/10"
                      onClick={async () => {
                        if (confirm('Are you sure you want to delete this part? This action cannot be undone.')) {
                          await deletePart(p.id);
                        }
                      }}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

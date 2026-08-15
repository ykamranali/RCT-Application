'use client';

import Link from 'next/link';
import { Server, Edit, Trash } from 'lucide-react';
import type { Asset } from '@rct/types';
import { deleteAsset } from '@/lib/actions/assets';

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

export function AssetTable({ assets }: { assets: (Asset & { customers: { company_name: string } })[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Model / S.N.</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((a) => (
            <TableRow key={a.id} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <Link
                      href={`/assets/${a.id}`}
                      className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {a.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{a.asset_tag}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {a.customers?.company_name || '-'}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div>{a.manufacturer || '-'} {a.model}</div>
                  <div className="text-xs text-muted-foreground font-mono">{a.serial_number || 'N/A'}</div>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={a.status === 'IN_SERVICE' ? 'default' : 'neutral'}
                  className={cn(
                    'capitalize',
                    a.status === 'IN_SERVICE' ? 'bg-success text-success-foreground' : ''
                  )}
                >
                  {a.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/assets/${a.id}`}><Edit className="h-4 w-4" /></Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-danger hover:text-danger hover:bg-danger/10"
                    onClick={async () => {
                      if (confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
                        await deleteAsset(a.id);
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

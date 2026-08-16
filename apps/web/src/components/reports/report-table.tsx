'use client';

import Link from 'next/link';
import { FileText, Download } from 'lucide-react';
import type { ServiceReport } from '@rct/types';

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

type ReportWithRelations = ServiceReport & {
  tickets?: { subject: string };
  customers?: { company_name: string };
  employees?: { full_name: string };
};

export function ReportTable({ reports }: { reports: ReportWithRelations[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead>Report Number</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Engineer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((r) => (
            <TableRow key={r.id} className="group">
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <Link
                      href={`/reports/${r.id}`}
                      className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {r.report_number}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate max-w-[250px]" title={r.tickets?.subject}>
                      {r.tickets?.subject || 'Unknown Ticket'}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {r.customers?.company_name || '-'}
              </TableCell>
              <TableCell>
                {r.employees?.full_name || '-'}
              </TableCell>
              <TableCell>
                <Badge
                  variant={r.status === 'signed' ? 'default' : 'neutral'}
                  className={cn(
                    'capitalize',
                    r.status === 'signed' ? 'bg-success text-success-foreground' : '',
                    r.status === 'draft' ? 'bg-muted text-muted-foreground' : ''
                  )}
                >
                  {r.status.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {r.pdf_url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={r.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" /> PDF
                    </a>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

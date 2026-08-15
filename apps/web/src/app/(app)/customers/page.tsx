import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Plus } from 'lucide-react';

import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';
import { CustomerTable } from '@/components/customers/customer-table';
import { CustomerDialog } from '@/components/customers/customer-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireStaff } from '@/lib/auth';
import { listCustomers } from '@/lib/queries';

export const metadata: Metadata = { title: 'Customers' };

const PAGE_SIZE = 25;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireStaff();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? '1') || 1);

  const { customers, total } = await listCustomers({
    status: params.status,
    type: params.type,
    search: params.q,
    sort: (params.sort as 'name' | 'newest') ?? 'name',
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description={`${total.toLocaleString()} customer${total === 1 ? '' : 's'} match the current filters.`}
        actions={<CustomerDialog />}
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No customers match those filters"
          description="Try widening the search or clearing a filter."
          action={
            <Button asChild variant="outline">
              <Link href="/customers">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0 md:p-2">
            <CustomerTable customers={customers} />
          </CardContent>
        </Card>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <p className="text-xs text-muted-foreground">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildHref(params, page - 1)}>Previous</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Previous</Button>
            )}
            {page < pages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildHref(params, page + 1)}>Next</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Next</Button>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function buildHref(params: Record<string, string | undefined>, page: number): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== 'page') next.set(key, value);
  }
  next.set('page', String(Math.max(1, page)));
  return `/customers?${next.toString()}`;
}

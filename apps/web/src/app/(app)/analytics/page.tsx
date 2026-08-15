import type { Metadata } from 'next';

import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendChart, CategoryPieChart, PriorityBarChart } from '@/components/analytics/charts';
import { requireStaff } from '@/lib/auth';
import { getDashboardStats } from '@/lib/queries';

export const metadata: Metadata = { title: 'Analytics' };

export default async function AnalyticsPage() {
  await requireStaff();
  const stats = await getDashboardStats();

  if (!stats) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Insights and reports on service delivery." />
        <div className="text-muted-foreground">Unable to load analytics data at this time.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Insights and reports on service delivery and ticket performance."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Tickets" value={stats.total_tickets} />
        <MetricCard title="Avg Resolution Time" value={`${stats.avg_resolution_hours?.toFixed(1) || '0'} hrs`} />
        <MetricCard title="SLA Compliance" value={`${stats.sla_compliance?.toFixed(1) || '0'}%`} />
        <MetricCard title="CSAT Score" value={`${stats.csat?.toFixed(1) || 'N/A'}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ticket Volume Trends (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={stats.monthly_trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tickets by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={stats.by_category} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tickets by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <PriorityBarChart data={stats.by_priority} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

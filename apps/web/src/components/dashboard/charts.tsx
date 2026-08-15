'use client';

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Chart palette.
 *
 * Deliberately not the raw brand blue repeated at different opacities:
 * adjacent series need to stay distinguishable in greyscale and for
 * colour-blind viewers, so hue and lightness both vary.
 */
const SERIES = ['#0e4fa1', '#0891b2', '#7c3aed', '#f59e0b', '#059669', '#e11d48', '#64748b'];

const AXIS = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 11,
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-float">
      {label ? <p className="mb-1 font-medium text-foreground">{label}</p> : null}
      {payload.map((entry: any) => (
        <p key={entry.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color ?? entry.fill }} aria-hidden />
          <span>{entry.name}</span>
          <span className="tabular ml-auto font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export function TicketTrendChart({
  data,
}: {
  data: { month: string; created: number; resolved: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ticket volume</CardTitle>
        <CardDescription>Raised against resolved, by month</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES[4]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={SERIES[4]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} {...AXIS} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} {...AXIS} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="created" name="Raised" stroke={SERIES[0]} strokeWidth={2} fill="url(#gCreated)" />
              <Area type="monotone" dataKey="resolved" name="Resolved" stroke={SERIES[4]} strokeWidth={2} fill="url(#gResolved)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function CategoryChart({ data }: { data: { name: string; count: number; colour?: string | null }[] }) {
  const top = [...data].sort((a, b) => b.count - a.count).slice(0, 8);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets by category</CardTitle>
        <CardDescription>Where the workload is coming from</CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} {...AXIS} />
              <YAxis type="category" dataKey="name" width={118} tickLine={false} axisLine={false} {...AXIS} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Bar dataKey="count" name="Tickets" radius={[0, 4, 4, 0]} barSize={16}>
                {top.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.colour ?? SERIES[i % SERIES.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function PriorityChart({
  data,
}: {
  data: { code: string; name: string; colour: string; count: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Priority mix</CardTitle>
        <CardDescription>Share of tickets by severity</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell key={entry.code} fill={entry.colour ?? SERIES[i % SERIES.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function EngineerLoadChart({
  data,
}: {
  data: { engineer_name: string; tickets_open: number; tickets_completed: number }[];
}) {
  const top = [...data].sort((a, b) => b.tickets_open - a.tickets_open).slice(0, 8);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engineer workload</CardTitle>
        <CardDescription>Open against completed this period</CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={top} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="engineer_name"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={56}
                {...AXIS}
              />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} {...AXIS} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="tickets_open" name="Open" fill={SERIES[3]} radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey="tickets_completed" name="Completed" fill={SERIES[4]} radius={[4, 4, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="grid h-[260px] place-items-center text-sm text-muted-foreground">
      No data for this period
    </div>
  );
}

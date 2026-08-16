import type { Metadata } from 'next';
import { requireManagement } from '@/lib/auth';
import { PageHeader } from '@/components/shell/page-header';
import { createServerSupabase } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export const metadata: Metadata = { title: 'Audit Log' };

export default async function AuditLogPage() {
  await requireManagement();
  
  const supabase = await createServerSupabase();
  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Audit Log"
        description="Review recent system activities and changes."
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity (Last 100)</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-danger">Failed to load audit logs: {error.message}</div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-muted-foreground">No audit logs found.</div>
          ) : (
            <ScrollArea className="h-[600px] w-full rounded-md border p-4">
              <div className="space-y-4">
                {logs.map((log: any) => (
                  <div key={log.id} className="flex flex-col space-y-1 border-b pb-4 last:border-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{log.action}</Badge>
                        <span className="font-semibold">{log.table_name}</span>
                        <span className="text-sm text-muted-foreground">
                          ID: {log.record_id}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm">
                      Performed by: <span className="font-medium">{log.profiles?.full_name || log.performed_by || 'System'}</span>
                    </div>
                    {log.old_data && Object.keys(log.old_data).length > 0 && (
                      <div className="text-xs mt-2 bg-muted p-2 rounded text-muted-foreground">
                        <span className="font-semibold text-foreground">Old:</span> {JSON.stringify(log.old_data)}
                      </div>
                    )}
                    {log.new_data && Object.keys(log.new_data).length > 0 && (
                      <div className="text-xs mt-1 bg-muted p-2 rounded text-muted-foreground">
                        <span className="font-semibold text-foreground">New:</span> {JSON.stringify(log.new_data)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

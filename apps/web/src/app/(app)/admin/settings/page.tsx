import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'System Settings' };

export default async function SettingsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="System Settings"
        description="Configure application-wide settings and preferences."
      />
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>Update the primary company information used in reports and emails.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" defaultValue="RAM Computer Technology" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input id="supportEmail" defaultValue="info@ramtechuae.com" />
            </div>
            <Button>Save Details</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SLA Engine</CardTitle>
            <CardDescription>Global SLA configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">System Timezone</Label>
              <Input id="timezone" defaultValue="Asia/Dubai" disabled />
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              Detailed SLA rules and calendars are managed in the SLA monitor section.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

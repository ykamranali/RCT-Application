import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Email Templates' };

export default async function EmailTemplatesPage() {
  await requireAdmin();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Email Templates"
        description="Manage the email notifications sent to customers and engineers."
      />
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ticket_created</CardTitle>
            <CardDescription>Sent to the customer when a new ticket is opened.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted p-4 font-mono text-sm">
              <p>Subject: Ticket Received: &#123;&#123;ticketNumber&#125;&#125;</p>
              <br/>
              <p>Hello &#123;&#123;customerName&#125;&#125;,</p>
              <p>We have received your ticket regarding "&#123;&#123;subject&#125;&#125;".</p>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline">Edit Template</Button>
              <Button variant="secondary">Send Test</Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>ticket_closed</CardTitle>
            <CardDescription>Sent to the customer with the PDF report when an engineer closes the ticket.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted p-4 font-mono text-sm">
              <p>Subject: Ticket Closed: &#123;&#123;ticketNumber&#125;&#125;</p>
              <br/>
              <p>Hello &#123;&#123;customerName&#125;&#125;,</p>
              <p>Your ticket has been resolved. Please find the attached service report.</p>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="outline">Edit Template</Button>
              <Button variant="secondary">Send Test</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

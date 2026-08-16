import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/shell/page-header';
import { EmailTemplatesTable } from '@/components/admin/email-templates-table';
import { createServerSupabase } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Email Templates' };

export default async function EmailTemplatesPage() {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .order('name');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Email Templates"
        description="Manage the automated emails sent by the system."
      />
      <EmailTemplatesTable templates={templates || []} />
    </div>
  );
}

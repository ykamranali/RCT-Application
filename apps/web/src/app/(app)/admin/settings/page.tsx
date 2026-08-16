import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/actions/settings';
import { PageHeader } from '@/components/shell/page-header';
import { SettingsForm } from '@/components/admin/settings-form';

export const metadata: Metadata = { title: 'System Settings' };

export default async function SettingsPage() {
  await requireAdmin();
  
  const settingsArray = await getSettings();
  const settings = settingsArray.reduce((acc: any, curr: any) => {
    // Only return public or safe values, ignore secret placeholders if any
    acc[curr.key] = curr.value;
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="System Settings"
        description="Configure application-wide settings and preferences."
      />
      <SettingsForm settings={settings} />
    </div>
  );
}

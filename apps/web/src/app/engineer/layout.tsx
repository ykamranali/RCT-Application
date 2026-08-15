import { redirect } from 'next/navigation';

import { AppShell } from '@/components/shell/app-shell';
import { requireSession } from '@/lib/auth';
import { getShellCounts } from '@/lib/queries';

export default async function EngineerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  if (session.profile.role !== 'engineer') {
    redirect(session.profile.customer_id ? '/portal' : '/dashboard');
  }
  if (session.profile.must_change_password) redirect('/reset-password');

  const counts = await getShellCounts(session.profile);

  return (
    <AppShell profile={session.profile} counts={counts}>
      <div id="main">{children}</div>
    </AppShell>
  );
}

import { redirect } from 'next/navigation';

import { isCustomer } from '@rct/types';

import { AppShell } from '@/components/shell/app-shell';
import { requireSession } from '@/lib/auth';
import { getShellCounts } from '@/lib/queries';

/**
 * Chrome for every staff-facing route. Customer principals are pushed to
 * their own portal so they can never land on an internal screen even if
 * they type the URL directly.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  if (isCustomer(session.profile.role)) redirect('/portal');
  if (session.profile.must_change_password) redirect('/reset-password');

  const counts = await getShellCounts(session.profile);

  return (
    <AppShell profile={session.profile} counts={counts}>
      <div id="main">{children}</div>
    </AppShell>
  );
}

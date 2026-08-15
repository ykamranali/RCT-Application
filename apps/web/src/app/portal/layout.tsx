import { redirect } from 'next/navigation';

import { isCustomer } from '@rct/types';

import { AppShell } from '@/components/shell/app-shell';
import { requireSession } from '@/lib/auth';
import { getShellCounts } from '@/lib/queries';

/**
 * Customer portal chrome. Staff are redirected out — the portal is scoped
 * to a single company, so a staff principal here would see an empty and
 * confusing view rather than a useful one.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  if (!isCustomer(session.profile.role)) redirect('/dashboard');
  if (session.profile.must_change_password) redirect('/reset-password');

  const counts = await getShellCounts(session.profile);

  return (
    <AppShell profile={session.profile} counts={counts}>
      <div id="main">{children}</div>
    </AppShell>
  );
}

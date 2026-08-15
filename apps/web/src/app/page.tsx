import { redirect } from 'next/navigation';

import { landingPathForRole } from '@rct/types';

import { getSession } from '@/lib/auth';

/** Root simply routes each principal to their own home. */
export default async function IndexPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  redirect(landingPathForRole(session.profile.role));
}

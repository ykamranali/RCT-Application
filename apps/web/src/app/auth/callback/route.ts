import { NextResponse, type NextRequest } from 'next/server';

import { landingPathForRole, type UserRole } from '@rct/types';

import { createServerSupabase } from '@/lib/supabase/server';

/**
 * OAuth / magic-link / email-confirmation landing point.
 *
 * Supabase redirects here with a one-time `code`, which is exchanged for a
 * session and written into cookies before the user is forwarded on.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const errorDescription = searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('That sign-in link is no longer valid. Please request a new one.')}`,
    );
  }

  // Only ever honour same-origin relative destinations.
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, must_change_password')
    .eq('id', data.user.id)
    .maybeSingle<{ role: UserRole; must_change_password: boolean }>();

  if (profile?.must_change_password) {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  return NextResponse.redirect(
    `${origin}${profile ? landingPathForRole(profile.role) : '/'}`,
  );
}

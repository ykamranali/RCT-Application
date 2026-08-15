import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { env } from '@/lib/env';

/**
 * Request-scoped Supabase client for Server Components, Route Handlers and
 * Server Actions.
 *
 * This client carries the signed-in user's JWT, which means every query it
 * runs is subject to Row Level Security. It is the client that should be used
 * for essentially all application reads and writes.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `cookies()` is read-only inside a Server Component render. The
          // session refresh performed by the middleware has already written
          // the rotated cookies, so this is safe to ignore here.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses Row Level Security entirely.
 *
 * Only for operations the database cannot express as a user action:
 *   - reading is_secret system settings (SMTP credentials)
 *   - writing email_logs on behalf of the system
 *   - provisioning auth users during admin-driven onboarding
 *   - scheduled jobs (SLA sweep, AMC status refresh)
 *
 * Never expose the returned client to the browser, never pass user-supplied
 * filters to it without validating them first, and never use it merely
 * because a policy is inconvenient.
 */
export function createAdminSupabase() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not configured. This operation requires elevated database access.',
    );
  }

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { 'X-Client-Info': 'rct-application/server' } },
  });
}

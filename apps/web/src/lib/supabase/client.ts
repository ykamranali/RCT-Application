'use client';

import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Browser Supabase client. Uses the anon key, so every query it makes is
 * still governed by Row Level Security - the anon key is a public
 * identifier, not a secret.
 */
export function createBrowserSupabase() {
  if (!client) {
    client = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  }
  return client;
}

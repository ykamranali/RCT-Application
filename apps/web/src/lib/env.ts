import { z } from 'zod';

/**
 * Environment validation.
 *
 * Server-only values are read lazily so that importing this module in a
 * client component does not throw. Anything prefixed NEXT_PUBLIC_ is
 * inlined by Next at build time and must be referenced literally, not
 * through a computed key.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

const parsedPublic = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

if (!parsedPublic.success) {
  const issues = parsedPublic.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(
    `RCT Application is not configured correctly.\n${issues}\n\n` +
      'Copy .env.example to .env.local and fill in your Supabase project details.',
  );
}

export const env = {
  ...parsedPublic.data,
  NEXT_PUBLIC_APP_URL: parsedPublic.data.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
} as const;

/** Absolute URL builder that works in every deployment target. */
export function appUrl(path = '/'): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return new URL(path, base).toString();
}

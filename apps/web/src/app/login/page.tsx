import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BRANDING, landingPathForRole } from '@rct/types';

import { LoginForm } from '@/components/forms/login-form';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(landingPathForRole(session.profile.role));

  const { next } = await searchParams;

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel - hidden on small screens so the form gets the space */}
      <aside className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="RCT Logo" className="h-16 object-contain drop-shadow-sm" />
        </div>

        <div className="max-w-sm space-y-4">
          <h2 className="text-2xl font-semibold leading-snug text-white text-balance">
            One place for every service call, engineer and contract.
          </h2>
          <p className="text-sm leading-relaxed text-sidebar-muted">
            Raise and track complaints, dispatch engineers, monitor SLA performance and issue
            signed service reports — from the office or from site.
          </p>
        </div>

        <p className="text-xs text-sidebar-muted">© {new Date().getFullYear()} {BRANDING.companyName}</p>
      </aside>

      <main id="main" className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex justify-center">
            <img src="/logo.png" alt="RCT Logo" className="h-20 object-contain drop-shadow-md" />
          </div>

          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              Use the email address your administrator registered.
            </p>
          </div>

          <LoginForm next={next} />

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Trouble signing in?{' '}
            <Link href="/forgot-password" className="font-medium text-primary hover:underline">
              Reset your password
            </Link>
          </p>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

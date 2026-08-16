import type { Metadata } from 'next';
import Link from 'next/link';

import { BRANDING } from '@rct/types';

import { RegisterForm } from '@/components/forms/register-form';

export const metadata: Metadata = { title: 'Sign up' };

export default function RegisterPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel - hidden on small screens so the form gets the space */}
      <aside className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-accent text-base font-bold text-white">
            R
          </span>
          <span className="leading-tight">
            <span className="block font-semibold text-white">{BRANDING.applicationName}</span>
            <span className="block text-xs uppercase tracking-wider text-sidebar-muted">
              {BRANDING.tagline}
            </span>
          </span>
        </div>

        <div className="max-w-sm space-y-4">
          <h2 className="text-2xl font-semibold leading-snug text-white text-balance">
            Join {BRANDING.applicationName}
          </h2>
          <p className="text-sm leading-relaxed text-sidebar-muted">
            Create an account to track complaints, dispatch engineers, and monitor SLA performance.
          </p>
        </div>

        <p className="text-xs text-sidebar-muted">© {new Date().getFullYear()} {BRANDING.companyName}</p>
      </aside>

      <main id="main" className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
              R
            </span>
          </div>

          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
            <p className="text-sm text-muted-foreground">
              Enter your details below to get started.
            </p>
          </div>

          <RegisterForm />

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

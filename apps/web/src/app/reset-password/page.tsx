import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/components/forms/reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="text-sm text-muted-foreground">
            Pick something you have not used elsewhere.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  );
}

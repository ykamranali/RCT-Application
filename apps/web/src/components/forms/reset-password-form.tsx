'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createBrowserSupabase } from '@/lib/supabase/client';

const schema = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .regex(/[a-z]/, 'Include a lower-case letter')
      .regex(/[A-Z]/, 'Include an upper-case letter')
      .regex(/[0-9]/, 'Include a number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'The two passwords do not match',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const supabase = createBrowserSupabase();

    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setFormError(
        error.message.toLowerCase().includes('session')
          ? 'This reset link has expired. Please request a new one.'
          : 'The password could not be updated. Please try again.',
      );
      return;
    }

    // Clear the first-login prompt now that a real password is set.
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', data.user.id);
    }

    toast.success('Your password has been updated.');
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError ? (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="password" required>New password</Label>
        <Input id="password" type="password" autoComplete="new-password" autoFocus aria-invalid={!!errors.password} {...register('password')} />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            At least 10 characters, with upper case, lower case and a number.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm" required>Confirm new password</Label>
        <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />
        {errors.confirm ? <p className="text-xs text-destructive">{errors.confirm.message}</p> : null}
      </div>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}

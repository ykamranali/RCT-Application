'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { registerUser } from '@/lib/actions/register';

export function RegisterForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const [values, setValues] = useState({
    role: 'customer_admin',
    companyName: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setErrors({});

    // Basic validation
    const newErrors: Record<string, string> = {};
    if (!values.fullName) newErrors.fullName = 'Full name is required';
    if (!values.email || !values.email.includes('@')) newErrors.email = 'Valid email is required';
    if (!values.password || values.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (values.role === 'customer_admin' && !values.companyName) newErrors.companyName = 'Company name is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      const result = await registerUser({
        email: values.email,
        password: values.password,
        full_name: values.fullName,
        phone: values.phone,
        role: values.role as any,
        company_name: values.companyName,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        if (result.needsApproval) {
          toast.success('Registration successful. Your account is pending admin approval.');
          router.push('/login');
        } else {
          toast.success('Registration successful. You can now log in.');
          router.push('/login');
        }
      }
    } catch (error: any) {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="I am a" required>
        <Select value={values.role} onValueChange={(v) => set('role', v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer_admin">Customer</SelectItem>
            <SelectItem value="engineer">Service Engineer</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {values.role === 'customer_admin' && (
        <Field label="Company Name" required error={errors.companyName}>
          <Input 
            placeholder="Acme Corp" 
            value={values.companyName} 
            onChange={(e) => set('companyName', e.target.value)} 
          />
        </Field>
      )}

      <Field label="Full Name" required error={errors.fullName}>
        <Input 
          placeholder="John Doe" 
          value={values.fullName} 
          onChange={(e) => set('fullName', e.target.value)} 
        />
      </Field>

      <Field label="Email Address" required error={errors.email}>
        <Input 
          type="email" 
          placeholder="you@company.com" 
          value={values.email} 
          onChange={(e) => set('email', e.target.value)} 
        />
      </Field>

      <Field label="Phone Number (Optional)">
        <Input 
          placeholder="+971 50 123 4567" 
          value={values.phone} 
          onChange={(e) => set('phone', e.target.value)} 
        />
      </Field>

      <Field label="Password" required error={errors.password}>
        <Input 
          type="password" 
          placeholder="••••••••" 
          value={values.password} 
          onChange={(e) => set('password', e.target.value)} 
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Sign Up
      </Button>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={required ? "after:content-['*'] after:ml-0.5 after:text-destructive" : ""}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

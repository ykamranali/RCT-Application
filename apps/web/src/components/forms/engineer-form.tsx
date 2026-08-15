'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createEngineer, updateEngineer } from '@/lib/actions/engineers';
import type { Employee } from '@rct/types';

export function EngineerForm({ initialData, onSuccess }: { initialData?: Employee; onSuccess?: () => void }) {
  const router = useRouter();

  const [values, setValues] = useState({
    employee_code: initialData?.employee_code ?? '',
    full_name: initialData?.full_name ?? '',
    email: initialData?.email ?? '',
    phone: initialData?.phone ?? '',
    job_title: initialData?.job_title ?? 'Field Service Engineer',
    status: initialData?.status ?? 'active',
    max_open_tickets: String(initialData?.max_open_tickets ?? 10),
    joining_date: initialData?.joining_date ?? '',
    notes: initialData?.notes ?? '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      if (!values.employee_code || !values.full_name || !values.email) {
        toast.error('Please fill all required fields');
        return;
      }

      const payload = {
        ...values,
        max_open_tickets: parseInt(values.max_open_tickets, 10),
        joining_date: values.joining_date || null,
      };

      if (initialData) {
        const res = await updateEngineer(initialData.id, payload as any);
        if (res.error) throw new Error(res.error);
        toast.success('Engineer updated successfully');
        if (onSuccess) onSuccess();
        else router.back();
      } else {
        const res = await createEngineer(payload as any);
        if (res.error) throw new Error(res.error);
        toast.success('Engineer created successfully');
        if (onSuccess) onSuccess();
        else router.back();
      }
    } catch (err: any) {
      toast.error(err.message || 'Unable to save engineer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee code" required error={errors.employee_code}>
              <Input
                value={values.employee_code}
                onChange={(e) => set('employee_code', e.target.value)}
                placeholder="e.g. ENG-001"
                disabled={!!initialData}
              />
            </Field>

            <Field label="Full name" required error={errors.full_name}>
              <Input
                value={values.full_name}
                onChange={(e) => set('full_name', e.target.value)}
              />
            </Field>

            <Field label="Email address" required error={errors.email}>
              <Input
                type="email"
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>

            <Field label="Phone number">
              <Input
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>

            <Field label="Job title">
              <Input
                value={values.job_title}
                onChange={(e) => set('job_title', e.target.value)}
              />
            </Field>

            <Field label="Status">
              <Select value={values.status} onValueChange={(v) => set('status', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Max open tickets" hint="Soft limit for auto-assignment">
              <Input
                type="number"
                min="1"
                value={values.max_open_tickets}
                onChange={(e) => set('max_open_tickets', e.target.value)}
              />
            </Field>

            <Field label="Joining date">
              <Input
                type="date"
                value={values.joining_date}
                onChange={(e) => set('joining_date', e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <Field label="Internal notes">
            <Textarea
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={4}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onSuccess ? onSuccess() : router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> Save engineer
        </Button>
      </div>
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

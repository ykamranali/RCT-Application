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
import { createCustomer, updateCustomer } from '@/lib/actions/customers';
import type { Customer } from '@rct/types';

export function CustomerForm({ initialData, onSuccess }: { initialData?: Customer; onSuccess?: () => void }) {
  const router = useRouter();

  const [values, setValues] = useState({
    customer_code: initialData?.customer_code ?? '',
    company_name: initialData?.company_name ?? '',
    customer_type: initialData?.customer_type ?? 'ON_CALL',
    status: initialData?.status ?? 'active',
    trade_licence_no: initialData?.trade_licence_no ?? '',
    tax_registration_no: initialData?.tax_registration_no ?? '',
    contact_person: initialData?.contact_person ?? '',
    email: initialData?.email ?? '',
    phone: initialData?.phone ?? '',
    alternate_phone: initialData?.alternate_phone ?? '',
    address_line1: initialData?.address_line1 ?? '',
    city: initialData?.city ?? '',
    emirate: initialData?.emirate ?? '',
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
      if (!values.customer_code || !values.company_name) {
        setErrors({
          customer_code: !values.customer_code ? 'Required' : '',
          company_name: !values.company_name ? 'Required' : '',
        });
        toast.error('Please fill all required fields');
        return;
      }

      if (initialData) {
        const res = await updateCustomer(initialData.id, values as any);
        if (res.error) throw new Error(res.error);
        toast.success('Customer updated successfully');
        if (onSuccess) onSuccess();
        else router.back();
      } else {
        const res = await createCustomer(values as any);
        if (res.error) throw new Error(res.error);
        toast.success('Customer created successfully');
        if (onSuccess) onSuccess();
        else router.back();
      }
    } catch (err: any) {
      toast.error(err.message || 'Unable to save customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer code" required error={errors.customer_code}>
              <Input
                value={values.customer_code}
                onChange={(e) => set('customer_code', e.target.value)}
                placeholder="e.g. CUS-001"
                disabled={!!initialData}
              />
            </Field>

            <Field label="Company name" required error={errors.company_name}>
              <Input
                value={values.company_name}
                onChange={(e) => set('company_name', e.target.value)}
                placeholder="Full legal name"
              />
            </Field>

            <Field label="Customer type" required error={errors.customer_type}>
              <Select value={values.customer_type} onValueChange={(v) => set('customer_type', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ON_CALL">On Call</SelectItem>
                  <SelectItem value="AMC">AMC Contract</SelectItem>
                  <SelectItem value="WARRANTY">Warranty</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Status" required error={errors.status}>
              <Select value={values.status} onValueChange={(v) => set('status', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Trade licence number">
              <Input
                value={values.trade_licence_no}
                onChange={(e) => set('trade_licence_no', e.target.value)}
              />
            </Field>

            <Field label="TRN (Tax Registration Number)">
              <Input
                value={values.tax_registration_no}
                onChange={(e) => set('tax_registration_no', e.target.value)}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm font-medium">Primary Contact</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact person">
              <Input value={values.contact_person} onChange={(e) => set('contact_person', e.target.value)} />
            </Field>
            <Field label="Email address">
              <Input type="email" value={values.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Phone number">
              <Input value={values.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Alternate phone">
              <Input value={values.alternate_phone} onChange={(e) => set('alternate_phone', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm font-medium">Head Office Location</p>
          <Field label="Address line 1">
            <Input value={values.address_line1} onChange={(e) => set('address_line1', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City">
              <Input value={values.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label="Emirate">
              <Select value={values.emirate} onValueChange={(v) => set('emirate', v)}>
                <SelectTrigger><SelectValue placeholder="Select emirate" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Abu Dhabi">Abu Dhabi</SelectItem>
                  <SelectItem value="Dubai">Dubai</SelectItem>
                  <SelectItem value="Sharjah">Sharjah</SelectItem>
                  <SelectItem value="Ajman">Ajman</SelectItem>
                  <SelectItem value="Umm Al Quwain">Umm Al Quwain</SelectItem>
                  <SelectItem value="Ras Al Khaimah">Ras Al Khaimah</SelectItem>
                  <SelectItem value="Fujairah">Fujairah</SelectItem>
                </SelectContent>
              </Select>
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
          <Save className="h-4 w-4 mr-2" /> Save customer
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

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
import { createAmc, updateAmc } from '@/lib/actions/amc';
import type { AmcContract } from '@rct/types';

export function AmcForm({ 
  initialData,
  customers,
  slaPlans,
  onSuccess,
}: { 
  initialData?: AmcContract,
  customers: { id: string; company_name: string }[],
  slaPlans: { id: string; name: string }[],
  onSuccess?: () => void
}) {
  const router = useRouter();

  const [values, setValues] = useState({
    amc_number: initialData?.amc_number ?? '',
    customer_id: initialData?.customer_id ?? '',
    contract_type: initialData?.contract_type ?? 'STANDARD',
    sla_plan_id: initialData?.sla_plan_id ?? '',
    start_date: initialData?.start_date ?? '',
    expiry_date: initialData?.expiry_date ?? '',
    status: initialData?.status ?? 'active',
    contract_value: String(initialData?.contract_value ?? ''),
    currency: initialData?.currency ?? 'AED',
    visits_included: String(initialData?.visits_included ?? ''),
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
      if (!values.amc_number || !values.customer_id || !values.start_date || !values.expiry_date) {
        toast.error('Please fill all required fields');
        return;
      }

      const payload = {
        ...values,
        sla_plan_id: values.sla_plan_id || null,
        contract_value: values.contract_value ? parseFloat(values.contract_value) : null,
        visits_included: values.visits_included ? parseInt(values.visits_included, 10) : null,
      };

      if (initialData) {
        const res = await updateAmc(initialData.id, payload as any);
        if (res.error) throw new Error(res.error);
        toast.success('Contract updated successfully');
        if (onSuccess) onSuccess();
        else router.back();
      } else {
        const res = await createAmc(payload as any);
        if (res.error) throw new Error(res.error);
        toast.success('Contract created successfully');
        if (onSuccess) onSuccess();
        else router.back();
      }
    } catch (err: any) {
      toast.error(err.message || 'Unable to save contract');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contract Number" required error={errors.amc_number}>
              <Input
                value={values.amc_number}
                onChange={(e) => set('amc_number', e.target.value)}
                placeholder="e.g. AMC-2026-001"
                disabled={!!initialData}
              />
            </Field>

            <Field label="Customer" required error={errors.customer_id}>
              <Select value={values.customer_id} onValueChange={(v) => set('customer_id', v)}>
                <SelectTrigger disabled={!!initialData}><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Contract Type" required>
              <Select value={values.contract_type} onValueChange={(v) => set('contract_type', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard SLA</SelectItem>
                  <SelectItem value="PREMIUM">Premium 24/7</SelectItem>
                  <SelectItem value="BASIC">Basic NBD</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Status" required>
              <Select value={values.status} onValueChange={(v) => set('status', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Start Date" required error={errors.start_date}>
              <Input
                type="date"
                value={values.start_date}
                onChange={(e) => set('start_date', e.target.value)}
              />
            </Field>

            <Field label="Expiry Date" required error={errors.expiry_date}>
              <Input
                type="date"
                value={values.expiry_date}
                onChange={(e) => set('expiry_date', e.target.value)}
              />
            </Field>

            <Field label="SLA Plan">
              <Select value={values.sla_plan_id} onValueChange={(v) => set('sla_plan_id', v)}>
                <SelectTrigger><SelectValue placeholder="Default SLA" /></SelectTrigger>
                <SelectContent>
                  {slaPlans.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm font-medium">Commercials (Optional)</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Contract Value">
              <Input 
                type="number" 
                value={values.contract_value} 
                onChange={(e) => set('contract_value', e.target.value)} 
              />
            </Field>
            <Field label="Currency">
              <Input 
                value={values.currency} 
                onChange={(e) => set('currency', e.target.value)} 
              />
            </Field>
            <Field label="Preventive Visits Included">
              <Input 
                type="number" 
                value={values.visits_included} 
                onChange={(e) => set('visits_included', e.target.value)} 
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
          <Save className="h-4 w-4 mr-2" /> Save contract
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

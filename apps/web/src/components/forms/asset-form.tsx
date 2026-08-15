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
import { createAsset, updateAsset } from '@/lib/actions/assets';
import type { Asset } from '@rct/types';

export function AssetForm({ 
  initialData,
  customers,
  onSuccess,
}: { 
  initialData?: Asset,
  customers: { id: string; company_name: string }[],
  onSuccess?: () => void
}) {
  const router = useRouter();

  const [values, setValues] = useState({
    asset_tag: initialData?.asset_tag ?? '',
    customer_id: initialData?.customer_id ?? '',
    name: initialData?.name ?? '',
    manufacturer: initialData?.manufacturer ?? '',
    model: initialData?.model ?? '',
    serial_number: initialData?.serial_number ?? '',
    status: initialData?.status ?? 'active',
    ip_address: initialData?.ip_address ?? '',
    mac_address: initialData?.mac_address ?? '',
    purchase_date: initialData?.purchase_date ?? '',
    warranty_expiry: initialData?.warranty_expiry ?? '',
    criticality: String(initialData?.criticality ?? 1),
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
      if (!values.asset_tag || !values.customer_id || !values.name) {
        toast.error('Please fill all required fields');
        return;
      }

      const payload = {
        ...values,
        criticality: parseInt(values.criticality, 10) || 1,
        purchase_date: values.purchase_date || null,
        warranty_expiry: values.warranty_expiry || null,
      };

      if (initialData) {
        const res = await updateAsset(initialData.id, payload as any);
        if (res.error) throw new Error(res.error);
        toast.success('Asset updated successfully');
        if (onSuccess) onSuccess();
        else router.back();
      } else {
        const res = await createAsset(payload as any);
        if (res.error) throw new Error(res.error);
        toast.success('Asset created successfully');
        if (onSuccess) onSuccess();
        else router.back();
      }
    } catch (err: any) {
      toast.error(err.message || 'Unable to save asset');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Asset Tag / ID" required error={errors.asset_tag}>
              <Input
                value={values.asset_tag}
                onChange={(e) => set('asset_tag', e.target.value)}
                placeholder="e.g. AST-001"
                disabled={!!initialData}
              />
            </Field>

            <Field label="Asset Name" required error={errors.name}>
              <Input
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
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

            <Field label="Status" required>
              <Select value={values.status} onValueChange={(v) => set('status', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (In Use)</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Under Maintenance</SelectItem>
                  <SelectItem value="retired">Retired / End of Life</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm font-medium">Hardware Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Manufacturer">
              <Input value={values.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} />
            </Field>
            <Field label="Model">
              <Input value={values.model} onChange={(e) => set('model', e.target.value)} />
            </Field>
            <Field label="Serial Number">
              <Input value={values.serial_number} onChange={(e) => set('serial_number', e.target.value)} />
            </Field>
            <Field label="Criticality (1-5)" hint="5 is highest priority">
              <Input type="number" min="1" max="5" value={values.criticality} onChange={(e) => set('criticality', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm font-medium">Network Details</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="IP Address">
              <Input value={values.ip_address} onChange={(e) => set('ip_address', e.target.value)} />
            </Field>
            <Field label="MAC Address">
              <Input value={values.mac_address} onChange={(e) => set('mac_address', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm font-medium">Lifecycle</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Purchase Date">
              <Input type="date" value={values.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} />
            </Field>
            <Field label="Warranty Expiry">
              <Input type="date" value={values.warranty_expiry} onChange={(e) => set('warranty_expiry', e.target.value)} />
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
          <Save className="h-4 w-4 mr-2" /> Save asset
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

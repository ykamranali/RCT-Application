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
import { createPart, updatePart } from '@/lib/actions/parts';
import type { PartCatalogue } from '@rct/types';

export function PartForm({ initialData, onSuccess }: { initialData?: PartCatalogue; onSuccess?: () => void }) {
  const router = useRouter();

  const [values, setValues] = useState({
    part_code: initialData?.part_code ?? '',
    name: initialData?.name ?? '',
    description: initialData?.description ?? '',
    unit: initialData?.unit ?? 'pcs',
    unit_cost: String(initialData?.unit_cost ?? ''),
    currency: initialData?.currency ?? 'AED',
    is_active: initialData?.is_active ?? true,
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
      if (!values.part_code || !values.name) {
        toast.error('Please fill all required fields');
        return;
      }

      const payload = {
        ...values,
        unit_cost: values.unit_cost ? parseFloat(values.unit_cost) : null,
      };

      if (initialData) {
        const res = await updatePart(initialData.id, payload as any);
        if (res.error) throw new Error(res.error);
        toast.success('Part updated successfully');
        if (onSuccess) onSuccess();
        else router.back();
      } else {
        const res = await createPart(payload as any);
        if (res.error) throw new Error(res.error);
        toast.success('Part created successfully');
        if (onSuccess) onSuccess();
        else router.back();
      }
    } catch (err: any) {
      toast.error(err.message || 'Unable to save part');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Part Code" required error={errors.part_code}>
              <Input
                value={values.part_code}
                onChange={(e) => set('part_code', e.target.value)}
                placeholder="e.g. PRT-1004"
                disabled={!!initialData}
              />
            </Field>

            <Field label="Part Name" required error={errors.name}>
              <Input
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>

            <Field label="Unit of Measurement">
              <Input
                value={values.unit}
                onChange={(e) => set('unit', e.target.value)}
                placeholder="e.g. pcs, kg, box"
              />
            </Field>

            <Field label="Active Status">
              <Select value={values.is_active ? "true" : "false"} onValueChange={(v) => set('is_active', v === "true")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm font-medium">Pricing</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Unit Cost">
              <Input type="number" step="0.01" value={values.unit_cost} onChange={(e) => set('unit_cost', e.target.value)} />
            </Field>
            <Field label="Currency">
              <Input value={values.currency} onChange={(e) => set('currency', e.target.value)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <Field label="Description">
            <Textarea
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onSuccess ? onSuccess() : router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> Save part
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

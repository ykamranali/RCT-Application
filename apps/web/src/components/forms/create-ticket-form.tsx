'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CheckCircle2, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createTicket } from '@/lib/actions/create-ticket';

export interface Option { id: string; name: string; code?: string; defaultPriorityId?: string | null }

/**
 * Complaint form used by both the customer portal and the staff console.
 * `mode` decides whether the customer and engineer pickers are shown; the
 * server action re-derives the tenant regardless of what is posted.
 */
export function CreateTicketForm({
  mode,
  categories,
  priorities,
  branches = [],
  customers = [],
  engineers = [],
  defaultContactName,
  defaultContactPhone,
  basePath = '/portal/tickets',
}: {
  mode: 'customer' | 'staff';
  categories: Option[];
  priorities: Option[];
  branches?: Option[];
  customers?: Option[];
  engineers?: Option[];
  defaultContactName?: string | null;
  defaultContactPhone?: string | null;
  basePath?: string;
}) {
  const router = useRouter();

  const defaultPriority = useMemo(
    () => priorities.find((p) => p.code === 'MEDIUM')?.id ?? priorities[0]?.id ?? '',
    [priorities],
  );

  const [values, setValues] = useState({
    subject: '',
    description: '',
    categoryId: '',
    priorityId: defaultPriority,
    branchId: '',
    customerId: '',
    assignedEngineerId: '',
    contactPerson: defaultContactName ?? '',
    contactPhone: defaultContactPhone ?? '',
    preferredVisitAt: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: string; number: string } | null>(null);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }

  // Picking a category pre-selects the priority the admin configured for it.
  function chooseCategory(categoryId: string) {
    const category = categories.find((c) => c.id === categoryId);
    setValues((v) => ({
      ...v,
      categoryId,
      priorityId: category?.defaultPriorityId ?? v.priorityId,
    }));
    setErrors((e) => ({ ...e, categoryId: '' }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const result = await createTicket({
        subject: values.subject,
        description: values.description,
        categoryId: values.categoryId || undefined,
        priorityId: values.priorityId || undefined,
        branchId: values.branchId || null,
        customerId: mode === 'staff' ? values.customerId || undefined : undefined,
        assignedEngineerId: mode === 'staff' ? values.assignedEngineerId || null : null,
        contactPerson: values.contactPerson || undefined,
        contactPhone: values.contactPhone || undefined,
        preferredVisitAt: values.preferredVisitAt
          ? new Date(values.preferredVisitAt).toISOString()
          : null,
      });

      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? 'Unable to create ticket. Please try again.');
        return;
      }

      setCreated({ id: result.ticketId!, number: result.ticketNumber! });
      router.refresh();
    } catch {
      toast.error('Unable to create ticket. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (created) {
    return (
      <Card className="border-success/40">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Complaint registered successfully</h2>
            <p className="text-sm text-muted-foreground">
              Our team has been notified and an engineer will be assigned shortly.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/40 px-6 py-4">
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">Ticket number</p>
            <p className="tabular mt-1 font-mono text-2xl font-semibold">{created.number}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-7 text-xs"
              onClick={() => {
                void navigator.clipboard.writeText(created.number);
                toast.success('Ticket number copied.');
              }}
            >
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href={`${basePath}/${created.id}`}>Track this ticket</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCreated(null);
                setValues((v) => ({ ...v, subject: '', description: '' }));
              }}
            >
              Raise another
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Card>
        <CardContent className="space-y-4 pt-5">
          {mode === 'staff' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer" required error={errors.customerId}>
                <Select value={values.customerId} onValueChange={(v) => set('customerId', v)}>
                  <SelectTrigger aria-label="Customer"><SelectValue placeholder="Choose a customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Assign to engineer" error={errors.assignedEngineerId}>
                <Select value={values.assignedEngineerId} onValueChange={(v) => set('assignedEngineerId', v)}>
                  <SelectTrigger aria-label="Engineer"><SelectValue placeholder="Assign later" /></SelectTrigger>
                  <SelectContent>
                    {engineers.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}

          <Field label="What is the problem?" required error={errors.subject}>
            <Input
              value={values.subject}
              onChange={(e) => set('subject', e.target.value)}
              placeholder="e.g. No internet connectivity on the second floor"
              maxLength={200}
              aria-invalid={!!errors.subject}
              autoFocus
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" required error={errors.categoryId}>
              <Select value={values.categoryId} onValueChange={chooseCategory}>
                <SelectTrigger aria-label="Category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="How urgent is it?" required error={errors.priorityId}>
              <Select value={values.priorityId} onValueChange={(v) => set('priorityId', v)}>
                <SelectTrigger aria-label="Priority"><SelectValue placeholder="Choose a priority" /></SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Tell us more"
            required
            error={errors.description}
            hint="What is happening, when it started, and how many people are affected."
          >
            <Textarea
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              rows={5}
              placeholder="Since this morning nobody in the accounts office can reach the internet. The switch in the comms room is showing an amber light."
              aria-invalid={!!errors.description}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm font-medium">Where and who</p>

          {branches.length > 0 ? (
            <Field label="Site" error={errors.branchId}>
              <Select value={values.branchId} onValueChange={(v) => set('branchId', v)}>
                <SelectTrigger aria-label="Site"><SelectValue placeholder="Choose a site" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Person to ask for on arrival" error={errors.contactPerson}>
              <Input value={values.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} placeholder="Full name" />
            </Field>
            <Field label="Contact number" error={errors.contactPhone}>
              <Input value={values.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="+971 50 000 0000" inputMode="tel" />
            </Field>
          </div>

          <Field label="Preferred visit time" hint="We will do our best, subject to your service level agreement.">
            <Input
              type="datetime-local"
              value={values.preferredVisitAt}
              onChange={(e) => set('preferredVisitAt', e.target.value)}
              className="sm:max-w-xs"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          <Send className="h-4 w-4" /> Submit complaint
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
      <Label required={required}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

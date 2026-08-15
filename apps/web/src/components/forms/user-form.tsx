'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { createUser, updateUser } from '@/lib/actions/users';
import { USER_ROLES } from '@rct/types';
import type { Profile } from '@rct/types';

export function UserForm({ initialData, onSuccess }: { initialData?: Profile; onSuccess?: () => void }) {
  const [values, setValues] = useState({
    email: initialData?.email ?? '',
    full_name: initialData?.full_name ?? '',
    phone: initialData?.phone ?? '',
    role: initialData?.role ?? 'engineer',
    is_active: initialData ? initialData.is_active : true,
  });

  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      if (!values.email || !values.full_name) {
        toast.error('Email and Full name are required');
        return;
      }

      if (initialData) {
        const res = await updateUser(initialData.id, values as any);
        if (res.error) throw new Error(res.error);
        toast.success('User updated successfully');
      } else {
        const res = await createUser(values as any);
        if (res.error) throw new Error(res.error);
        toast.success('User created successfully');
      }
      
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Unable to save user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label>Full name</Label>
        <Input 
          value={values.full_name} 
          onChange={(e) => setValues(v => ({ ...v, full_name: e.target.value }))} 
        />
      </div>

      <div className="space-y-1.5">
        <Label>Email address</Label>
        <Input 
          type="email" 
          disabled={!!initialData}
          value={values.email} 
          onChange={(e) => setValues(v => ({ ...v, email: e.target.value }))} 
        />
      </div>

      <div className="space-y-1.5">
        <Label>Phone number</Label>
        <Input 
          value={values.phone} 
          onChange={(e) => setValues(v => ({ ...v, phone: e.target.value }))} 
        />
      </div>

      <div className="space-y-1.5">
        <Label>Role</Label>
        <Select value={values.role} onValueChange={(v) => setValues(vls => ({ ...vls, role: v as any }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {USER_ROLES.map(role => (
              <SelectItem key={role} value={role}>{role.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Switch 
          id="is_active" 
          checked={values.is_active} 
          onCheckedChange={(checked) => setValues(v => ({ ...v, is_active: checked }))} 
        />
        <Label htmlFor="is_active">User is active</Label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-4">
        {onSuccess && (
          <Button type="button" variant="outline" onClick={onSuccess} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          <Save className="h-4 w-4 mr-2" /> Save user
        </Button>
      </div>
    </form>
  );
}

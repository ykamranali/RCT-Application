'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { CustomerInsert, Customer } from '@rct/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';

export async function createCustomer(data: CustomerInsert) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { data: customer, error } = await supabase
    .from('customers')
    .insert(data)
    .select('id')
    .single();

  if (error) {
    console.error('Error creating customer:', error);
    return { error: error.message };
  }

  revalidatePath('/customers');
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', id);

  if (error) {
    console.error('Error updating customer:', error);
    return { error: error.message };
  }

  revalidatePath('/customers');
  revalidatePath(`/customers/${id}`);
  return { success: true };
}

export async function deleteCustomer(id: string) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting customer:', error);
    return { error: error.message };
  }

  revalidatePath('/customers');
  return { success: true };
}

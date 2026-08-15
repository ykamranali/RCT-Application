'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { Employee } from '@rct/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';

type EmployeeInsert = Partial<Employee> & { employee_code: string; full_name: string; email: string };

export async function createEngineer(data: EmployeeInsert) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { data: engineer, error } = await supabase
    .from('employees')
    .insert({ ...data, role: 'engineer' })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating engineer:', error);
    return { error: error.message };
  }

  revalidatePath('/engineers');
  redirect(`/engineers/${engineer.id}`);
}

export async function updateEngineer(id: string, data: Partial<Employee>) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('employees')
    .update(data)
    .eq('id', id);

  if (error) {
    console.error('Error updating engineer:', error);
    return { error: error.message };
  }

  revalidatePath('/engineers');
  revalidatePath(`/engineers/${id}`);
  return { success: true };
}

export async function deleteEngineer(id: string) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
    .eq('role', 'engineer');

  if (error) {
    console.error('Error deleting engineer:', error);
    return { error: error.message };
  }

  revalidatePath('/engineers');
  return { success: true };
}

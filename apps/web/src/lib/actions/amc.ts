'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { AmcContract } from '@rct/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';

type AmcInsert = Partial<AmcContract> & { 
  amc_number: string; 
  customer_id: string; 
  contract_type: string; 
  start_date: string; 
  expiry_date: string; 
};

export async function createAmc(data: AmcInsert) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { data: amc, error } = await supabase
    .from('amc_contracts')
    .insert(data)
    .select('id')
    .single();

  if (error) {
    console.error('Error creating AMC:', error);
    return { error: error.message };
  }

  revalidatePath('/amc');
  redirect(`/amc/${amc.id}`);
}

export async function updateAmc(id: string, data: Partial<AmcContract>) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('amc_contracts')
    .update(data)
    .eq('id', id);

  if (error) {
    console.error('Error updating AMC:', error);
    return { error: error.message };
  }

  revalidatePath('/amc');
  revalidatePath(`/amc/${id}`);
  return { success: true };
}

export async function deleteAmc(id: string) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('amc_contracts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting AMC:', error);
    return { error: error.message };
  }

  revalidatePath('/amc');
  return { success: true };
}

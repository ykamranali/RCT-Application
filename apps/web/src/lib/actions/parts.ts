'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { PartCatalogue } from '@rct/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';

type PartInsert = Partial<PartCatalogue> & { 
  part_code: string; 
  name: string; 
};

export async function createPart(data: PartInsert) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { data: part, error } = await supabase
    .from('parts_catalogue')
    .insert(data)
    .select('id')
    .single();

  if (error) {
    console.error('Error creating part:', error);
    return { error: error.message };
  }

  revalidatePath('/parts');
  redirect(`/parts/${part.id}`);
}

export async function updatePart(id: string, data: Partial<PartCatalogue>) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('parts_catalogue')
    .update(data)
    .eq('id', id);

  if (error) {
    console.error('Error updating part:', error);
    return { error: error.message };
  }

  revalidatePath('/parts');
  revalidatePath(`/parts/${id}`);
  return { success: true };
}

export async function deletePart(id: string) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('parts_catalogue')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting part:', error);
    return { error: error.message };
  }

  revalidatePath('/parts');
  return { success: true };
}

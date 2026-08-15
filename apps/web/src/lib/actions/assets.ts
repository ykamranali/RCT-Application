'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import type { Asset } from '@rct/types';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth';

type AssetInsert = Partial<Asset> & { 
  asset_tag: string; 
  customer_id: string; 
  name: string; 
};

export async function createAsset(data: AssetInsert) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { data: asset, error } = await supabase
    .from('assets')
    .insert(data)
    .select('id')
    .single();

  if (error) {
    console.error('Error creating asset:', error);
    return { error: error.message };
  }

  revalidatePath('/assets');
  redirect(`/assets/${asset.id}`);
}

export async function updateAsset(id: string, data: Partial<Asset>) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('assets')
    .update(data)
    .eq('id', id);

  if (error) {
    console.error('Error updating asset:', error);
    return { error: error.message };
  }

  revalidatePath('/assets');
  revalidatePath(`/assets/${id}`);
  return { success: true };
}

export async function deleteAsset(id: string) {
  await requireStaff();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting asset:', error);
    return { error: error.message };
  }

  revalidatePath('/assets');
  return { success: true };
}

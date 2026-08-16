'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';

export async function getSettings() {
  await requireAdmin();
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('system_settings').select('*');
  return data ?? [];
}

export async function updateSetting(key: string, value: any) {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('system_settings')
    .update({ value })
    .eq('key', key);

  if (error) {
    console.error(`Error updating setting ${key}:`, error);
    return { error: error.message };
  }

  revalidatePath('/admin/settings');
  return { success: true };
}

export async function updateSettingsBatch(settings: Record<string, any>) {
  await requireAdmin();
  const supabase = await createServerSupabase();

  for (const [key, value] of Object.entries(settings)) {
    // Only update non-empty values or values that explicitly need to be set
    const { error } = await supabase
      .from('system_settings')
      .update({ value })
      .eq('key', key);

    if (error) {
      console.error(`Error updating setting ${key}:`, error);
      return { error: error.message };
    }
  }

  revalidatePath('/admin/settings');
  return { success: true };
}

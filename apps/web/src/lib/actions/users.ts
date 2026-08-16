'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createServerSupabase, createAdminSupabase } from '@/lib/supabase/server';
import type { Profile } from '@rct/types';

export async function updateUser(id: string, data: Partial<Profile>) {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', id);

  if (error) {
    console.error('Error updating user:', error);
    return { error: error.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}

export async function createUser(data: {
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active?: boolean;
}) {
  await requireAdmin();
  const supabase = await createAdminSupabase();

  // Create Auth User
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: Math.random().toString(36).slice(-10) + 'A1!',
    email_confirm: true,
  });

  if (authError) {
    console.error('Error creating auth user:', authError);
    return { error: authError.message };
  }

  // Create Profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone || null,
      role: data.role,
      is_active: data.is_active ?? true,
      must_change_password: true,
    });

  if (profileError) {
    console.error('Error creating profile:', profileError);
    // Best effort cleanup
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { error: profileError.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}

export async function deleteUser(id: string) {
  await requireAdmin();
  const supabaseAdmin = await createAdminSupabase();

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

  if (error) {
    console.error('Error deleting user:', error);
    return { error: error.message };
  }

  revalidatePath('/admin/users');
  return { success: true };
}

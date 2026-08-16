'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase/server';

export async function updateEmailTemplate(id: string, values: any) {
  await requireAdmin();
  const supabase = await createServerSupabase();

  const { error } = await supabase
    .from('email_templates')
    .update({
      subject: values.subject,
      body_html: values.body_html,
      body_text: values.body_text
    })
    .eq('id', id);

  if (error) {
    console.error(`Error updating email template:`, error);
    return { error: error.message };
  }

  revalidatePath('/admin/settings/email-templates');
  return { success: true };
}

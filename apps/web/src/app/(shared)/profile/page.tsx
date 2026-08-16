import type { Metadata } from 'next';
import { requireSession } from '@/lib/auth';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'My Profile' };

export default async function ProfilePage() {
  const session = await requireSession();
  const profile = session.profile;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="My Profile"
        description="Manage your personal information."
      />
      
      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
          <CardDescription>Update your contact info.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" action={async (formData) => {
            'use server';
            const { profile: currentProfile } = await requireSession();
            const supabase = await import('@/lib/supabase/server').then(m => m.createServerSupabase());
            await supabase.from('profiles').update({
              full_name: formData.get('full_name') as string,
              phone: formData.get('phone') as string,
            }).eq('id', currentProfile.id);
            const { revalidatePath } = await import('next/cache');
            revalidatePath('/profile');
          }}>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" defaultValue={profile.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" name="full_name" defaultValue={profile.full_name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" name="phone" defaultValue={profile.phone || ''} />
            </div>
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

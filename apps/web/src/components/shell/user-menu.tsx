'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, LogOut, UserCog } from 'lucide-react';
import { toast } from 'sonner';

import { ROLE_LABELS, type Profile } from '@rct/types';

import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createBrowserSupabase } from '@/lib/supabase/client';

export function UserMenu({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Could not sign you out. Please try again.');
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2">
          <UserAvatar name={profile.full_name} src={profile.avatar_url} className="h-7 w-7" />
          <span className="hidden text-left leading-tight sm:block">
            <span className="block max-w-[10rem] truncate text-xs font-medium">{profile.full_name}</span>
            <span className="block text-2xs text-muted-foreground">{ROLE_LABELS[profile.role]}</span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">{profile.full_name}</span>
          <span className="block truncate text-xs text-muted-foreground">{profile.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserCog className="h-4 w-4" /> Profile and password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive disabled={signingOut} onSelect={(e) => { e.preventDefault(); void signOut(); }}>
          <LogOut className="h-4 w-4" /> {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

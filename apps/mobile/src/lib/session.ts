import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  employee_id: string | null;
  customer_id: string | null;
  is_active: boolean;
}

/** Current session plus the matching profile row. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile(current: Session | null) {
      if (!current) {
        if (active) { setProfile(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, employee_id, customer_id, is_active')
        .eq('id', current.user.id)
        .maybeSingle<Profile>();

      if (!active) return;
      // A deactivated account must not be able to keep using a cached session.
      if (data && !data.is_active) {
        await supabase.auth.signOut();
        setProfile(null);
      } else {
        setProfile(data ?? null);
      }
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void loadProfile(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void loadProfile(next);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { session, profile, loading };
}

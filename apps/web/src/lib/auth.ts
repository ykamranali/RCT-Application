import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import {
  isAdmin,
  isCustomer,
  isManagement,
  isStaff,
  landingPathForRole,
  type Profile,
  type UserRole,
} from '@rct/types';

import { createServerSupabase } from '@/lib/supabase/server';

export interface Session {
  userId: string;
  email: string | null;
  profile: Profile;
}

/**
 * The signed-in principal, or null.
 *
 * Wrapped in React's `cache` so that a page which checks permissions in the
 * layout, the page and three server components still issues a single query
 * per request.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createServerSupabase();

  // getUser() revalidates the JWT against the auth server. getSession()
  // would trust a cookie that could have been tampered with, so it is
  // deliberately not used for authorisation decisions.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Profile>();

  if (!profile || !profile.is_active) return null;

  return { userId: user.id, email: user.email ?? null, profile };
});

/** Require any signed-in, active user. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

/**
 * Require one of the given roles.
 *
 * A user who is signed in but lacks the role is sent to their own landing
 * page rather than to /login - bouncing an authenticated user to a sign-in
 * screen is confusing and looks like a bug.
 */
export async function requireRole(...roles: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.profile.role)) {
    redirect(landingPathForRole(session.profile.role));
  }
  return session;
}

export async function requireStaff(): Promise<Session> {
  const session = await requireSession();
  if (!isStaff(session.profile.role)) redirect(landingPathForRole(session.profile.role));
  return session;
}

export async function requireManagement(): Promise<Session> {
  const session = await requireSession();
  if (!isManagement(session.profile.role)) redirect(landingPathForRole(session.profile.role));
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!isAdmin(session.profile.role)) redirect(landingPathForRole(session.profile.role));
  return session;
}

export async function requireCustomer(): Promise<Session> {
  const session = await requireSession();
  if (!isCustomer(session.profile.role)) redirect(landingPathForRole(session.profile.role));
  return session;
}

/**
 * Permission check for API routes and server actions, where redirecting is
 * the wrong response. Returns the session or throws a ForbiddenError.
 */
export class UnauthorisedError extends Error {
  readonly status = 401;
  constructor(message = 'You need to sign in to do that.') {
    super(message);
    this.name = 'UnauthorisedError';
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = 'You do not have permission to do that.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function assertRole(...roles: UserRole[]): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorisedError();
  if (!roles.includes(session.profile.role)) throw new ForbiddenError();
  return session;
}

export async function assertStaff(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorisedError();
  if (!isStaff(session.profile.role)) throw new ForbiddenError();
  return session;
}

export async function assertManagement(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorisedError();
  if (!isManagement(session.profile.role)) throw new ForbiddenError();
  return session;
}

/**
 * Fine-grained check against the role_permissions matrix.
 * The database enforces the same rules through RLS; this exists so the API
 * can return a clear 403 instead of an empty result set.
 */
export async function hasPermission(code: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('has_permission', { p_code: code });
  if (error) return false;
  return data === true;
}

import 'server-only';

import { isCustomer, type DashboardStats, type Profile, type TicketOverview } from '@rct/types';

import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Shared read helpers.
 *
 * None of these apply tenant filters by hand: Row Level Security already
 * scopes every result to the caller. A customer calling countOpenTickets()
 * counts only their own company's tickets because the database says so.
 */

export interface ShellCounts {
  openTickets: number;
  unread: number;
  breached: number;
}

export async function getShellCounts(profile: Profile): Promise<ShellCounts> {
  const supabase = await createServerSupabase();

  const openQuery = supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .not('status', 'in', '("CLOSED","CANCELLED")');

  // An engineer's sidebar should show their own workload, not the company's.
  if (profile.role === 'engineer' && profile.employee_id) {
    openQuery.eq('assigned_engineer_id', profile.employee_id);
  }

  const [open, unread, breached] = await Promise.all([
    openQuery,
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null),
    isCustomer(profile.role)
      ? Promise.resolve({ count: 0 })
      : supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('resolution_state', 'breached')
          .not('status', 'in', '("CLOSED","CANCELLED")'),
  ]);

  return {
    openTickets: open.count ?? 0,
    unread: unread.count ?? 0,
    breached: breached.count ?? 0,
  };
}

export async function getDashboardStats(from?: Date, to?: Date): Promise<DashboardStats | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('dashboard_stats', {
    p_from: from?.toISOString() ?? null,
    p_to: to?.toISOString() ?? null,
  });
  if (error) return null;
  return data as DashboardStats;
}

export interface TicketFilters {
  status?: string[];
  priority?: string;
  customerId?: string;
  engineerId?: string;
  categoryId?: string;
  slaState?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  sort?: 'newest' | 'oldest' | 'due' | 'priority';
}

export async function listTickets(filters: TicketFilters = {}) {
  const supabase = await createServerSupabase();
  const limit = Math.min(filters.limit ?? 25, 100);
  const offset = filters.offset ?? 0;

  let query = supabase.from('v_tickets_overview').select('*', { count: 'exact' });

  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.priority) query = query.eq('priority_code', filters.priority);
  if (filters.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters.engineerId) query = query.eq('assigned_engineer_id', filters.engineerId);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.slaState) query = query.eq('resolution_state', filters.slaState);
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(
      `ticket_number.ilike.${term},subject.ilike.${term},customer_name.ilike.${term}`,
    );
  }

  switch (filters.sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'due':
      query = query.order('resolution_due_at', { ascending: true, nullsFirst: false });
      break;
    case 'priority':
      query = query
        .order('priority_severity', { ascending: false })
        .order('created_at', { ascending: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data, count, error } = await query.range(offset, offset + limit - 1);

  return {
    tickets: (data as TicketOverview[] | null) ?? [],
    total: count ?? 0,
    error: error?.message ?? null,
    limit,
    offset,
  };
}

export async function getTicket(id: string): Promise<TicketOverview | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('v_tickets_overview')
    .select('*')
    .eq('id', id)
    .maybeSingle<TicketOverview>();
  return data;
}

export async function getTicketTimeline(ticketId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('ticket_status_history')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getTicketComments(ticketId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('ticket_comments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getTicketAttachments(ticketId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('ticket_attachments')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getTicketParts(ticketId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('ticket_parts')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

/** Reference data for the ticket forms. Cached per request by React. */
export async function getFormOptions() {
  const supabase = await createServerSupabase();
  const [categories, priorities, customers, engineers] = await Promise.all([
    supabase.from('categories').select('id, code, name, colour, default_priority_id').eq('is_active', true).order('sort_order'),
    supabase.from('priorities').select('id, code, name, colour, severity, is_default').eq('is_active', true).order('severity'),
    supabase.from('customers').select('id, customer_code, company_name').eq('status', 'active').order('company_name'),
    supabase.from('employees').select('id, employee_code, full_name, job_title').eq('role', 'engineer').eq('status', 'active').order('full_name'),
  ]);

  return {
    categories: categories.data ?? [],
    priorities: priorities.data ?? [],
    customers: customers.data ?? [],
    engineers: engineers.data ?? [],
  };
}

export async function getBranchesForCustomer(customerId: string) {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('branches')
    .select('id, branch_code, branch_name, contact_person, phone, city, emirate')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .order('is_head_office', { ascending: false })
    .order('branch_name');
  return data ?? [];
}

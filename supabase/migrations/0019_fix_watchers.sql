create or replace function app.ticket_watchers(p_ticket_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select coalesce(array_agg(distinct pid), '{}')
  from (
    -- assigned engineer
    select e.profile_id as pid
    from public.tickets t
    join public.employees e on e.id = t.assigned_engineer_id
    where t.id = p_ticket_id
    union
    -- service manager
    select e.profile_id
    from public.tickets t
    join public.employees e on e.id = t.service_manager_id
    where t.id = p_ticket_id
    union
    -- customer / creator
    select t.created_by
    from public.tickets t
    where t.id = p_ticket_id
    union
    -- every management / admin principal
    select p.id
    from public.profiles p
    where p.is_active
      and p.role in ('super_admin', 'admin', 'management', 'service_manager')
  ) as watchers;
$$;

-- =====================================================================
-- RCT APPLICATION | Migration 0015 - Storage buckets and policies
--
-- Every bucket is private. Files are served to the browser through
-- short-lived signed URLs minted server-side after the API has checked
-- the caller's permissions.
--
-- Path convention:
--   ticket-attachments/<ticket_id>/<uuid>-<filename>
--   service-reports/<ticket_id>/<report_number>.pdf
--   signatures/<ticket_id>/<uuid>.png
--   avatars/<profile_id>/<uuid>.<ext>
--   company/<filename>            (logo, letterhead)
-- =====================================================================

insert into storage.buckets (id, name, public)
values
  ('ticket-attachments', 'ticket-attachments', false),
  ('service-reports',    'service-reports',    false),
  ('signatures',         'signatures',         false),
  ('avatars',            'avatars',            false),
  ('company',            'company',            false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- The first path segment of every ticket-scoped object is the ticket id,
-- so the storage policies can reuse the same visibility rule as the rows.
-- ---------------------------------------------------------------------
create or replace function app.storage_ticket_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_first text := (storage.foldername(p_name))[1];
begin
  return v_first::uuid;
exception when others then
  return null;
end;
$$;

-- ---- ticket attachments ---------------------------------------------
drop policy if exists "ticket attachments are readable by the ticket audience" on storage.objects;
create policy "ticket attachments are readable by the ticket audience"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and app.can_access_ticket(app.storage_ticket_id(name))
  );

drop policy if exists "ticket attachments are writable by the ticket audience" on storage.objects;
create policy "ticket attachments are writable by the ticket audience"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and app.can_access_ticket(app.storage_ticket_id(name))
  );

drop policy if exists "ticket attachments are removable by staff" on storage.objects;
create policy "ticket attachments are removable by staff"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'ticket-attachments'
    and app.is_management()
  );

-- ---- service reports (read only for the audience; written by server) --
drop policy if exists "service reports are readable by the ticket audience" on storage.objects;
create policy "service reports are readable by the ticket audience"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'service-reports'
    and app.can_access_ticket(app.storage_ticket_id(name))
  );

-- ---- signatures ------------------------------------------------------
drop policy if exists "signatures are readable by the ticket audience" on storage.objects;
create policy "signatures are readable by the ticket audience"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'signatures'
    and app.can_access_ticket(app.storage_ticket_id(name))
  );

drop policy if exists "signatures may be captured by the ticket audience" on storage.objects;
create policy "signatures may be captured by the ticket audience"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'signatures'
    and app.can_access_ticket(app.storage_ticket_id(name))
  );

-- ---- avatars: a user owns their own folder ---------------------------
drop policy if exists "avatars are readable by authenticated users" on storage.objects;
create policy "avatars are readable by authenticated users"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "users manage their own avatar" on storage.objects;
create policy "users manage their own avatar"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or app.is_admin())
  )
  with check (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = auth.uid()::text or app.is_admin())
  );

-- ---- company branding ------------------------------------------------
drop policy if exists "company assets are readable by authenticated users" on storage.objects;
create policy "company assets are readable by authenticated users"
  on storage.objects for select to authenticated
  using (bucket_id = 'company');

drop policy if exists "company assets are managed by admins" on storage.objects;
create policy "company assets are managed by admins"
  on storage.objects for all to authenticated
  using (bucket_id = 'company' and app.is_admin())
  with check (bucket_id = 'company' and app.is_admin());

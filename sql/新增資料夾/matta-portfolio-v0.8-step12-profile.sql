-- ============================================================
-- MATTA Learning Portfolio · Migration v0.8 · Step 12
-- MT profile fields + public "avatars" storage bucket
-- Safe to re-run.
-- ============================================================

-- ---------- 1) New profile columns ----------
alter table public.users_profile
  add column if not exists avatar_path text,
  add column if not exists phone text,
  add column if not exists bio text;

-- ---------- 2) Public avatars bucket ----------
-- Public read: profile photos render directly in <img> tags and
-- printed reports without signed URLs. Only images, max 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,               -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- 3) Storage policies ----------
-- Path convention: {user_id}/avatar_{timestamp}.{ext}

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

drop policy if exists "avatars: user uploads own" on storage.objects;
create policy "avatars: user uploads own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: user updates own" on storage.objects;
create policy "avatars: user updates own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars: user deletes own" on storage.objects;
create policy "avatars: user deletes own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

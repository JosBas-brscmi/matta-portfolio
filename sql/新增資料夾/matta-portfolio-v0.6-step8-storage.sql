-- ============================================================
-- MATTA Learning Portfolio · Migration v0.6 · Step 8
-- Storage bucket "portfolio-files" + RLS on storage.objects
--
-- Storage path convention (enforced by policies below):
--   {trainee_id}/{portfolio_item_id}/{timestamp}_{filename}
--   └─ first folder segment MUST be the trainee's UUID
--
-- Prereqs: v0.1–v0.5 already applied (helper functions
--   public.auth_trainee_id(), public.can_view_trainee(uuid),
--   public.is_admin() must exist — they do since v0.1).
-- Safe to re-run: bucket upsert + drop-and-recreate policies.
-- ============================================================

-- ---------- 1) Create (or update) the private bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-files',
  'portfolio-files',
  false,                    -- private: downloads go through signed URLs
  104857600,                -- 100 MB per file
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  -- .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        -- .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',-- .pptx
    'application/msword',                -- legacy .doc
    'application/vnd.ms-excel',          -- legacy .xls
    'application/vnd.ms-powerpoint',     -- legacy .ppt
    'image/jpeg',
    'image/png',
    'video/mp4',
    'video/quicktime',                   -- .mov
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

-- ---------- 2) RLS policies on storage.objects ----------
-- storage.objects already has RLS enabled by Supabase.

-- READ: anyone who may view the trainee (self, mentor, dept manager,
-- MA Center, MA Board, owner) can read that trainee's files.
drop policy if exists "portfolio-files: read if can view trainee" on storage.objects;
create policy "portfolio-files: read if can view trainee"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'portfolio-files'
    and (
      public.is_admin()
      or public.can_view_trainee(((storage.foldername(name))[1])::uuid)
    )
  );

-- INSERT: MT may upload only into their own {trainee_id}/ folder;
-- admins (owner / ma_center) may upload anywhere in the bucket.
drop policy if exists "portfolio-files: MT upload to own folder" on storage.objects;
create policy "portfolio-files: MT upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portfolio-files'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (public.auth_trainee_id())::text
    )
  );

-- UPDATE (rare — overwrite/upsert): same ownership rule.
drop policy if exists "portfolio-files: MT update own files" on storage.objects;
create policy "portfolio-files: MT update own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'portfolio-files'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (public.auth_trainee_id())::text
    )
  );

-- DELETE: MT may delete files in their own folder; admins may delete any.
drop policy if exists "portfolio-files: MT delete own files" on storage.objects;
create policy "portfolio-files: MT delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'portfolio-files'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = (public.auth_trainee_id())::text
    )
  );

-- ---------- 3) Tighten portfolio_items status values ----------
-- Guard the status column against typos from any client.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'portfolio_items_status_check'
  ) then
    alter table public.portfolio_items
      add constraint portfolio_items_status_check
      check (status in ('pending', 'approved', 'returned'));
  end if;
end $$;

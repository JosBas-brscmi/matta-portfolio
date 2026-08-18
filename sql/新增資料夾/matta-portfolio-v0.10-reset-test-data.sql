-- ============================================================
-- MATTA Learning Portfolio · v0.10 · RESET TEST DATA
--
-- ⚠️  WARNING 警告: This permanently deletes ALL data and ALL
--     accounts EXCEPT users with role = 'owner'.
--     此腳本會永久刪除所有測試資料與帳號，只保留 owner。
--     Cannot be undone. 無法復原。
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

begin;

-- 1) Child records first (order matters for foreign keys)
delete from public.reviews;
delete from public.assessments;
delete from public.portfolio_files;
delete from public.portfolio_items;
delete from public.training_records;
delete from public.courses;
delete from public.trainees;

-- 2) Uploaded files (metadata rows in both buckets)
delete from storage.objects
where bucket_id in ('portfolio-files', 'avatars');

-- 3) All auth users except owner(s).
--    users_profile rows are removed via cascade / trigger.
delete from auth.users
where id not in (
  select id from public.users_profile where role = 'owner'
);

-- 4) Safety check — should return ONLY your owner account
commit;

select email, full_name, role, status
from public.users_profile
order by created_at;

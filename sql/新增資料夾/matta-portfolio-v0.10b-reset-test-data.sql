-- ============================================================
-- MATTA Learning Portfolio · v0.10b · RESET TEST DATA (fixed)
--
-- ⚠️  Permanently deletes ALL data and ALL accounts EXCEPT
--     users with role = 'owner'. Cannot be undone.
--     永久刪除所有測試資料與帳號，只保留 owner，無法復原。
--
-- Note: Supabase blocks SQL deletes on storage.objects.
--       Uploaded files must be cleared via Storage UI (see chat).
-- ============================================================

begin;

delete from public.reviews;
delete from public.assessments;
delete from public.portfolio_files;
delete from public.portfolio_items;
delete from public.training_records;
delete from public.courses;
delete from public.trainees;

delete from auth.users
where id not in (
  select id from public.users_profile where role = 'owner'
);

commit;

-- Safety check — should list ONLY your owner account
select email, full_name, role, status
from public.users_profile
order by created_at;

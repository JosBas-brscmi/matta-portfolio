-- ============================================================
-- MATTA Learning Portfolio · v0.11 · Step 16
-- Let MTs reply once to each feedback entry (text + emoji).
-- Reply is written via a SECURITY DEFINER function so the MT
-- can ONLY touch the reply columns, never the reviewer's text.
-- Safe to re-run.
-- ============================================================

-- 1) New columns
alter table public.reviews
  add column if not exists mt_reply text,
  add column if not exists mt_reply_at timestamptz;

-- 2) Secure reply function
--    - caller must be the trainee who owns this review
--    - only mt_reply / mt_reply_at are updated
--    - passing an empty string clears the reply
create or replace function public.reply_to_review(
  p_review_id uuid,
  p_reply text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trainee uuid;
begin
  v_trainee := public.auth_trainee_id();
  if v_trainee is null then
    raise exception 'Only trainees can reply to feedback';
  end if;

  update public.reviews
     set mt_reply = nullif(btrim(p_reply), ''),
         mt_reply_at = case when nullif(btrim(p_reply), '') is null
                            then null else now() end
   where id = p_review_id
     and trainee_id = v_trainee;

  if not found then
    raise exception 'Feedback not found or not yours';
  end if;
end;
$$;

grant execute on function public.reply_to_review(uuid, text) to authenticated;

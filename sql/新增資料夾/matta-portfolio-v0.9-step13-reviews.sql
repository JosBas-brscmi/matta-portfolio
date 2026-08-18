-- ============================================================
-- MATTA Learning Portfolio · Migration v0.9 · Step 13
-- Mentor–MT feedback via the reviews table.
--  1) Let MA Board (chairman / GM / senior mgmt) also write
--     feedback — optional encouragement notes.
--  2) Reviewers can delete their own reviews.
--  3) Align review_type / rating constraints with the frontend.
-- Safe to re-run.
-- ============================================================

-- ---------- 1) Widen the INSERT policy to include ma_board ----------
drop policy if exists "reviews: mentor/manager/MA Center can write" on public.reviews;
drop policy if exists "reviews: supervisors and board can write" on public.reviews;
create policy "reviews: supervisors and board can write"
  on public.reviews for insert
  to authenticated
  with check (
    public.auth_role() = any (array['mentor', 'manager', 'ma_center', 'ma_board', 'owner'])
    and public.can_view_trainee(trainee_id)
    and reviewer_id = auth.uid()
  );

-- ---------- 2) Reviewers may delete their own reviews ----------
drop policy if exists "reviews: reviewer can delete own reviews" on public.reviews;
create policy "reviews: reviewer can delete own reviews"
  on public.reviews for delete
  to authenticated
  using ( reviewer_id = auth.uid() );

-- ---------- 3) Align constraints with the frontend option lists ----------
alter table public.reviews
  drop constraint if exists reviews_review_type_check;
alter table public.reviews
  add constraint reviews_review_type_check
  check (review_type in (
    'weekly_note',
    'monthly_review',
    'encouragement',
    'manager_observation',
    'other'
  ));

alter table public.reviews
  drop constraint if exists reviews_rating_check;
alter table public.reviews
  add constraint reviews_rating_check
  check ( rating is null or (rating >= 1 and rating <= 5) );

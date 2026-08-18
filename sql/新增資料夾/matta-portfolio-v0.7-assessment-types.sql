-- ============================================================
-- MATTA Learning Portfolio · Migration v0.7 · Step 10 hotfix
-- Align assessments.assessment_type CHECK constraint with the
-- frontend option list (assessmentService.ts).
-- Safe to re-run.
-- ============================================================

alter table public.assessments
  drop constraint if exists assessments_assessment_type_check;

alter table public.assessments
  add constraint assessments_assessment_type_check
  check (assessment_type in (
    'entrance_test',
    'course_quiz',
    'monthly_test',
    'midterm',
    'final',
    'department_eval',
    'other'
  ));

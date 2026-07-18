-- Recurrent planner tasks stay as one task definition. The generated blocks
-- make the selected occurrences visible to the daily planner without losing
-- the recurrence rule or creating duplicate Google Calendar series.
ALTER TABLE public.planner_tasks
  ADD COLUMN IF NOT EXISTS recurrence_days smallint[] NOT NULL DEFAULT '{}'::smallint[],
  ADD COLUMN IF NOT EXISTS recurrence_until date,
  ADD COLUMN IF NOT EXISTS sync_to_google_calendar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_calendar_event_id text;

ALTER TABLE public.planner_tasks
  DROP CONSTRAINT IF EXISTS planner_tasks_recurrence_days_valid;
ALTER TABLE public.planner_tasks
  ADD CONSTRAINT planner_tasks_recurrence_days_valid
  CHECK (COALESCE(recurrence_days <@ ARRAY[0,1,2,3,4,5,6]::smallint[], true));

CREATE INDEX IF NOT EXISTS planner_tasks_user_recurrence_idx
  ON public.planner_tasks(user_id, scheduled_for, recurrence_until)
  WHERE cardinality(recurrence_days) > 0;

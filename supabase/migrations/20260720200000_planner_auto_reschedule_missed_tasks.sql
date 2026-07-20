-- Auto-reschedule: tareas del planner que quedaron sin completar en una
-- fecha pasada se mueven solas al día actual, para que el usuario nunca
-- tenga que "buscarlas" ni pierda seguimiento de lo que quedó pendiente.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.roll_forward_missed_planner_tasks()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.planner_tasks
  SET scheduled_for = CURRENT_DATE,
      status = 'postponed',
      postponed_count = COALESCE(postponed_count, 0) + 1
  WHERE status IN ('backlog', 'scheduled', 'postponed')
    AND scheduled_for IS NOT NULL
    AND scheduled_for < CURRENT_DATE;
$$;

SELECT cron.schedule(
  'planner-roll-forward-missed-tasks',
  '10 5 * * *',
  $$SELECT public.roll_forward_missed_planner_tasks();$$
);

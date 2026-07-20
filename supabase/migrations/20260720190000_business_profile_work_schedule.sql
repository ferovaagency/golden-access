-- Días y horario laboral del negocio, para que el Planner (y la IA) sepan
-- cuándo agendar/reprogramar en vez de asumir horario fijo. Mismo formato
-- smallint[] (0=domingo..6=sábado) que ya usa planner_tasks.recurrence_days.
ALTER TABLE public.business_profile
  ADD COLUMN IF NOT EXISTS dias_laborales smallint[] NOT NULL DEFAULT '{1,2,3,4,5}'::smallint[],
  ADD COLUMN IF NOT EXISTS horario_inicio text NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS horario_fin text NOT NULL DEFAULT '18:00';

ALTER TABLE public.business_profile
  DROP CONSTRAINT IF EXISTS business_profile_dias_laborales_valid;
ALTER TABLE public.business_profile
  ADD CONSTRAINT business_profile_dias_laborales_valid
  CHECK (dias_laborales <@ ARRAY[0,1,2,3,4,5,6]::smallint[]);

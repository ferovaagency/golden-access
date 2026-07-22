-- The workday is entered in the user's local civil time. Keeping the IANA
-- timezone with the profile prevents the planner from assuming Colombia for
-- every account and avoids UTC/browser offset shifts in previews.
ALTER TABLE public.business_profile
  ADD COLUMN IF NOT EXISTS zona_horaria text NOT NULL DEFAULT 'America/Bogota';

ALTER TABLE public.business_profile
  ADD CONSTRAINT business_profile_zona_horaria_valid
  CHECK (zona_horaria ~ '^[A-Za-z]+(?:[_+-][A-Za-z]+)*(?:/[A-Za-z]+(?:[_+-][A-Za-z]+)*)+$') NOT VALID;

ALTER TABLE public.business_profile
  VALIDATE CONSTRAINT business_profile_zona_horaria_valid;

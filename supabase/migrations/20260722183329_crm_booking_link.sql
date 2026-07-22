ALTER TABLE public.business_profile
  ADD COLUMN IF NOT EXISTS booking_calendar_url text;

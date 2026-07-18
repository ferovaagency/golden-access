CREATE TABLE IF NOT EXISTS public.paddle_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.paddle_webhook_events TO service_role;
ALTER TABLE public.paddle_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service only" ON public.paddle_webhook_events;
CREATE POLICY "service only" ON public.paddle_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_paddle_webhook_events_type ON public.paddle_webhook_events(event_type, processed_at DESC);

-- Business Health snapshots (one per user per day)
CREATE TABLE public.business_health_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  previous_score INTEGER,
  delta INTEGER NOT NULL DEFAULT 0,
  sub_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  narrative TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_health_snapshots TO authenticated;
GRANT ALL ON public.business_health_snapshots TO service_role;

ALTER TABLE public.business_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own health snapshots"
  ON public.business_health_snapshots
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_health_snapshots_user_date ON public.business_health_snapshots (user_id, snapshot_date DESC);

CREATE TRIGGER trg_health_snapshots_updated
  BEFORE UPDATE ON public.business_health_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Structured Blind Spot insights (replaces free-form planner_insights consumption on Home)
DO $$ BEGIN
  CREATE TYPE public.blindspot_category AS ENUM (
    'client_at_risk','revenue_concentration','cash_risk','late_invoice',
    'project_hours_overrun','low_margin_project','employee_overload',
    'unused_capacity','no_followup','postponed_task','marketing_inactive',
    'low_sales_activity','bottleneck','opportunity'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.blindspot_urgency AS ENUM ('critical','high','medium','low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.business_blindspots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.blindspot_category NOT NULL,
  urgency public.blindspot_urgency NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  why TEXT NOT NULL,
  impact TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  action_route TEXT,
  metric_value NUMERIC,
  metric_label TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_blindspots TO authenticated;
GRANT ALL ON public.business_blindspots TO service_role;

ALTER TABLE public.business_blindspots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own blindspots"
  ON public.business_blindspots
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_blindspots_user_open ON public.business_blindspots (user_id, urgency, detected_at DESC)
  WHERE dismissed_at IS NULL AND resolved_at IS NULL;

CREATE TRIGGER trg_blindspots_updated
  BEFORE UPDATE ON public.business_blindspots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

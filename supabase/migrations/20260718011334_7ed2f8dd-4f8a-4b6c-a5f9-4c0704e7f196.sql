
CREATE TYPE public.ceo_report_period AS ENUM ('daily','weekly','monthly');

CREATE TABLE public.ceo_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period ceo_report_period NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  headline TEXT,
  summary_md TEXT,
  wins JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  health_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period, period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ceo_reports TO authenticated;
GRANT ALL ON public.ceo_reports TO service_role;
ALTER TABLE public.ceo_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ceo_reports" ON public.ceo_reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_ceo_reports_updated BEFORE UPDATE ON public.ceo_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_ceo_reports_user_period ON public.ceo_reports(user_id, period, period_start DESC);

CREATE TABLE public.decision_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  scenario_type TEXT NOT NULL,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.decision_simulations TO authenticated;
GRANT ALL ON public.decision_simulations TO service_role;
ALTER TABLE public.decision_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own decision_simulations" ON public.decision_simulations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_decision_sims_user ON public.decision_simulations(user_id, created_at DESC);

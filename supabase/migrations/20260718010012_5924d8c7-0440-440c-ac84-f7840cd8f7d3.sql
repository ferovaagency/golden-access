
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.planner_item_type AS ENUM ('task','reminder','project','idea','note','purchase','event','client','finance','unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.planner_priority AS ENUM ('low','medium','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.planner_energy AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.planner_category AS ENUM ('deep_work','meetings','admin','creative','calls','learning','personal','breaks');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.planner_task_status AS ENUM ('backlog','scheduled','in_progress','done','postponed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.planner_goal_horizon AS ENUM ('annual','quarterly','monthly','weekly','daily');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.planner_insight_severity AS ENUM ('info','warn','risk','opportunity');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ INBOX ============
CREATE TABLE IF NOT EXISTS public.planner_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  detected_type public.planner_item_type,
  detected_priority public.planner_priority,
  detected_energy public.planner_energy,
  detected_category public.planner_category,
  detected_duration_min INT,
  detected_deadline TIMESTAMPTZ,
  detected_client TEXT,
  detected_project TEXT,
  ai_confidence NUMERIC(4,3),
  ai_reasoning TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_inbox TO authenticated;
GRANT ALL ON public.planner_inbox TO service_role;
ALTER TABLE public.planner_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbox own rows" ON public.planner_inbox FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ TASKS ============
CREATE TABLE IF NOT EXISTS public.planner_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category public.planner_category NOT NULL DEFAULT 'admin',
  priority public.planner_priority NOT NULL DEFAULT 'medium',
  energy_required public.planner_energy NOT NULL DEFAULT 'medium',
  estimated_minutes INT NOT NULL DEFAULT 30,
  actual_minutes INT,
  deadline TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  status public.planner_task_status NOT NULL DEFAULT 'backlog',
  project_ref TEXT,
  client_ref TEXT,
  goal_id UUID,
  source_inbox_id UUID REFERENCES public.planner_inbox(id) ON DELETE SET NULL,
  ai_notes TEXT,
  completed_at TIMESTAMPTZ,
  postponed_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_tasks TO authenticated;
GRANT ALL ON public.planner_tasks TO service_role;
ALTER TABLE public.planner_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks own rows" ON public.planner_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS planner_tasks_user_status_idx ON public.planner_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS planner_tasks_user_scheduled_idx ON public.planner_tasks(user_id, scheduled_for);

-- ============ BLOCKS ============
CREATE TABLE IF NOT EXISTS public.planner_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category public.planner_category NOT NULL DEFAULT 'deep_work',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  task_ids UUID[] NOT NULL DEFAULT '{}',
  is_locked BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'ai',
  external_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_blocks TO authenticated;
GRANT ALL ON public.planner_blocks TO service_role;
ALTER TABLE public.planner_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks own rows" ON public.planner_blocks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS planner_blocks_user_range_idx ON public.planner_blocks(user_id, starts_at, ends_at);

-- ============ ROUTINES ============
CREATE TABLE IF NOT EXISTS public.planner_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category public.planner_category NOT NULL DEFAULT 'admin',
  cadence TEXT NOT NULL DEFAULT 'weekly',
  weekday INT,
  hour INT,
  duration_min INT NOT NULL DEFAULT 30,
  energy_required public.planner_energy NOT NULL DEFAULT 'medium',
  active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_routines TO authenticated;
GRANT ALL ON public.planner_routines TO service_role;
ALTER TABLE public.planner_routines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routines own rows" ON public.planner_routines FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ GOALS ============
CREATE TABLE IF NOT EXISTS public.planner_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  horizon public.planner_goal_horizon NOT NULL,
  metric TEXT,
  target NUMERIC,
  progress NUMERIC NOT NULL DEFAULT 0,
  parent_goal_id UUID REFERENCES public.planner_goals(id) ON DELETE SET NULL,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_goals TO authenticated;
GRANT ALL ON public.planner_goals TO service_role;
ALTER TABLE public.planner_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals own rows" ON public.planner_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ BEHAVIOR ============
CREATE TABLE IF NOT EXISTS public.planner_behavior (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_value JSONB NOT NULL,
  sample_count INT NOT NULL DEFAULT 1,
  window_days INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, metric_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_behavior TO authenticated;
GRANT ALL ON public.planner_behavior TO service_role;
ALTER TABLE public.planner_behavior ENABLE ROW LEVEL SECURITY;
CREATE POLICY "behavior own rows" ON public.planner_behavior FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ INSIGHTS ============
CREATE TABLE IF NOT EXISTS public.planner_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  severity public.planner_insight_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_hint TEXT,
  action_route TEXT,
  data JSONB,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_insights TO authenticated;
GRANT ALL ON public.planner_insights TO service_role;
ALTER TABLE public.planner_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insights own rows" ON public.planner_insights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS planner_insights_user_dismissed_idx ON public.planner_insights(user_id, dismissed);

-- ============ BRIEFINGS ============
CREATE TABLE IF NOT EXISTS public.planner_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  briefing_date DATE NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, kind, briefing_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_briefings TO authenticated;
GRANT ALL ON public.planner_briefings TO service_role;
ALTER TABLE public.planner_briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefings own rows" ON public.planner_briefings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ updated_at triggers ============
DO $$ BEGIN
  CREATE TRIGGER planner_inbox_updated BEFORE UPDATE ON public.planner_inbox FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER planner_tasks_updated BEFORE UPDATE ON public.planner_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER planner_blocks_updated BEFORE UPDATE ON public.planner_blocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER planner_routines_updated BEFORE UPDATE ON public.planner_routines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER planner_goals_updated BEFORE UPDATE ON public.planner_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER planner_insights_updated BEFORE UPDATE ON public.planner_insights FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

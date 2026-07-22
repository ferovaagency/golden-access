-- Manual 4.13: inputs explicit for the explainable planner Priority Score.
-- Values are bounded 1..5 so neither UI nor AI can persist opaque weights.
ALTER TABLE public.planner_tasks
  ADD COLUMN IF NOT EXISTS financial_impact SMALLINT NOT NULL DEFAULT 3 CHECK (financial_impact BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS client_impact SMALLINT NOT NULL DEFAULT 3 CHECK (client_impact BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS risk_score SMALLINT NOT NULL DEFAULT 3 CHECK (risk_score BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS execution_ease SMALLINT NOT NULL DEFAULT 3 CHECK (execution_ease BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS dependency_task_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.planner_tasks.financial_impact IS '1-5, explicitly confirmed or suggested financial impact for Planner priority score.';
COMMENT ON COLUMN public.planner_tasks.client_impact IS '1-5, explicitly confirmed or suggested client impact for Planner priority score.';
COMMENT ON COLUMN public.planner_tasks.risk_score IS '1-5, consequence of delaying the task for Planner priority score.';
COMMENT ON COLUMN public.planner_tasks.execution_ease IS '1-5, ease/low friction to execute; higher makes a task easier to fit.';
COMMENT ON COLUMN public.planner_tasks.dependency_task_ids IS 'Tasks that must be completed before this task can enter an automatic day plan.';

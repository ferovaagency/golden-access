-- RLS policies filter these tables by user_id on every query; without an
-- index that's a sequential scan that gets worse as each table grows.
CREATE INDEX IF NOT EXISTS finance_receivable_payments_user_id_idx ON public.finance_receivable_payments(user_id);
CREATE INDEX IF NOT EXISTS planner_goals_user_id_idx ON public.planner_goals(user_id);
CREATE INDEX IF NOT EXISTS planner_inbox_user_id_idx ON public.planner_inbox(user_id);
CREATE INDEX IF NOT EXISTS planner_routines_user_id_idx ON public.planner_routines(user_id);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  action_tab text,
  sender_name text NOT NULL DEFAULT 'María Fernanda',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient
  ON public.user_notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT INSERT, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own notifications" ON public.user_notifications;
CREATE POLICY "users read own notifications" ON public.user_notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_team_member());
DROP POLICY IF EXISTS "users mark own notifications" ON public.user_notifications;
CREATE POLICY "users mark own notifications" ON public.user_notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "team sends notifications" ON public.user_notifications;
CREATE POLICY "team sends notifications" ON public.user_notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member());
DROP POLICY IF EXISTS "team deletes notifications" ON public.user_notifications;
CREATE POLICY "team deletes notifications" ON public.user_notifications FOR DELETE TO authenticated
  USING (public.is_team_member());

-- Consolidacion: existian DOS mecanismos de "reprogramar tareas vencidas"
-- (el cron diario roll_forward_missed_planner_tasks, que respeta dias
-- laborales, y un duplicado client-side agregado en paralelo que no los
-- respetaba). Se conserva SOLO el del cron, y ahora deja evidencia en
-- audit_log (Fase 7: toda accion automatica queda auditada y visible),
-- que es lo que el banner del Planner lee para avisar al usuario.
CREATE OR REPLACE FUNCTION public.roll_forward_missed_planner_tasks()
RETURNS void
LANGUAGE plpgsql
SET search_path TO public, extensions
AS $$
DECLARE
  moved RECORD;
BEGIN
  FOR moved IN
    UPDATE public.planner_tasks t
    SET scheduled_for = next_day.d,
        status = 'postponed',
        postponed_count = COALESCE(t.postponed_count, 0) + 1
    FROM (
      SELECT pt.id,
        pt.user_id,
        pt.title,
        pt.scheduled_for AS prev_date,
        COALESCE(
          (SELECT MIN(gs::date)
           FROM generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '13 days', INTERVAL '1 day') AS gs
           WHERE EXTRACT(DOW FROM gs)::smallint = ANY (COALESCE(bp.dias_laborales, ARRAY[1,2,3,4,5]::smallint[]))),
          CURRENT_DATE
        ) AS d
      FROM public.planner_tasks pt
      LEFT JOIN public.business_profile bp ON bp.user_id = pt.user_id
      WHERE pt.status IN ('backlog', 'scheduled', 'postponed')
        AND pt.scheduled_for IS NOT NULL
        AND pt.scheduled_for < CURRENT_DATE
    ) AS next_day
    WHERE t.id = next_day.id
    RETURNING t.id, next_day.user_id, next_day.title, next_day.prev_date, next_day.d
  LOOP
    INSERT INTO public.audit_log (user_id, entity_type, entity_id, actor, action, description, previous_value, new_value, status, resolved_at)
    VALUES (
      moved.user_id,
      'planner_task',
      moved.id::text,
      'system',
      'reprogramado_automatico',
      format('"%s" no se completó en su fecha (%s) y se reprogramó automáticamente al siguiente día laboral (%s).', moved.title, moved.prev_date, moved.d),
      jsonb_build_object('scheduled_for', moved.prev_date),
      jsonb_build_object('scheduled_for', moved.d),
      'aplicado',
      now()
    );
  END LOOP;
END;
$$;

-- Solo el cron (postgres) debe ejecutarla; ningun rol de la API la necesita.
REVOKE ALL ON FUNCTION public.roll_forward_missed_planner_tasks() FROM public, anon, authenticated;

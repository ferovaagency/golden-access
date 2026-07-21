-- roll_forward_missed_planner_tasks() reprogramaba siempre a CURRENT_DATE,
-- sin mirar los días laborales configurados por cada usuario -- una tarea
-- perdida en viernes podía terminar reprogramada a sábado. Ahora busca el
-- próximo día laboral real (según business_profile.dias_laborales) por
-- usuario, con fallback a lunes-viernes si no tiene perfil configurado.
CREATE OR REPLACE FUNCTION public.roll_forward_missed_planner_tasks()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.planner_tasks t
  SET scheduled_for = next_day.d,
      status = 'postponed',
      postponed_count = COALESCE(t.postponed_count, 0) + 1
  FROM (
    SELECT pt.id,
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
  WHERE t.id = next_day.id;
END;
$$;

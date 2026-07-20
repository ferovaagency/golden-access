-- Las citas de diagnóstico que ya pasaron se marcan solas como "completada"
-- en vez de quedar indefinidamente como "agendada" en el panel de Citas.
CREATE OR REPLACE FUNCTION public.complete_past_crm_citas()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.crm_citas_diagnostico
  SET estado = 'completada'
  WHERE estado = 'agendada'
    AND fecha_hora + (duracion_min || ' minutes')::interval < now();
$$;

SELECT cron.schedule(
  'crm-citas-complete-past',
  '20 5 * * *',
  $$SELECT public.complete_past_crm_citas();$$
);

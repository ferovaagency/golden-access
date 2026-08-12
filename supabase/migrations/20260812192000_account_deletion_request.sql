-- Fase 6 (confianza) — Ferova One: solicitud de eliminación de cuenta con gracia.
--
-- El borrado inmediato es irreversible y no se puede deshacer si fue un error.
-- En su lugar, el usuario SOLICITA la eliminación y queda un período de gracia
-- durante el cual puede cancelarla. Un trabajo programado (cron) hace la purga
-- real cuando deletion_scheduled_for ya pasó (ver docs/PLAN_LANZAMIENTO_ESTADO.md),
-- borrando también los datos derivados (embeddings del cerebro).
--
-- Aquí solo se agregan las marcas de intención; nada se destruye.

alter table public.business_profile
  add column if not exists deletion_requested_at timestamptz;

alter table public.business_profile
  add column if not exists deletion_scheduled_for timestamptz;

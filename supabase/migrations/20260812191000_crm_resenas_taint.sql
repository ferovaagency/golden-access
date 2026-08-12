-- Fase 6 (confianza) — Ferova One: marca de origen no confiable en reseñas.
--
-- reviews-scan lee CORREOS (contenido no confiable) y los pasa a la IA para
-- extraer la reseña, que hoy se inserta directo en crm_resenas. Eso mezcla
-- contenido externo potencialmente manipulado (prompt-injection) con los datos
-- del negocio sin ningún filtro humano. Añadimos:
--   - origen: de dónde vino la fila ('manual' | 'ia_email').
--   - confirmada: si un humano ya la validó. Las derivadas de correo entran en
--     false y NO deben propagarse a métricas ni al contexto del asistente hasta
--     que alguien las confirme.
-- Las filas existentes quedan como confirmadas para no ocultar histórico.

alter table public.crm_resenas
  add column if not exists origen text not null default 'manual';

alter table public.crm_resenas
  add column if not exists confirmada boolean not null default true;

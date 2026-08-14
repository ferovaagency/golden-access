-- Fase 6 — que el borrado borre de verdad, y que lo que escribe la IA a partir
-- de contenido externo quede marcado.

-- 1) Tres tablas que sobrevivían al borrado de la cuenta ---------------------
--
-- 45 tablas públicas referencian auth.users con ON DELETE CASCADE, así que
-- `deleteUser` (purge-deleted-accounts) las limpia. Estas tres NO tenían la
-- llave: sus filas quedaban huérfanas después de que alguien pidiera borrar su
-- cuenta. `business_assistant_messages` es la peor de las tres: son las
-- conversaciones con el asistente, o sea lo más personal que guarda el sistema.
--
-- Verificado antes de crear la llave: 0 filas huérfanas en las tres (16 / 0 / 0),
-- así que la restricción entra sin conflictos.

alter table public.business_assistant_messages
  drop constraint if exists business_assistant_messages_user_id_fkey,
  add  constraint business_assistant_messages_user_id_fkey
       foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.project_kpis
  drop constraint if exists project_kpis_user_id_fkey,
  add  constraint project_kpis_user_id_fkey
       foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.project_kpi_entries
  drop constraint if exists project_kpi_entries_user_id_fkey,
  add  constraint project_kpi_entries_user_id_fkey
       foreign key (user_id) references auth.users(id) on delete cascade;

-- 2) Taint en las oportunidades que escribe la IA ----------------------------
--
-- `sortlist-leads-scan` lee correos (contenido NO confiable), se los pasa a la
-- IA e inserta oportunidades directo en el CRM. Es la misma clase de riesgo que
-- ya se cerró en crm_resenas: un correo preparado puede dictarle a la IA qué
-- escribir. La regla general: si el razonamiento pasó por contenido externo, la
-- escritura queda marcada y no se propaga hasta que un humano la confirme.
--
-- Las filas que ya existen quedan como 'manual' + confirmada: son las que se
-- crearon a mano o antes de esta distinción, y marcarlas de golpe como dudosas
-- sería mentir sobre su origen.

alter table public.crm_oportunidades
  add column if not exists origen     text    not null default 'manual',
  add column if not exists confirmada boolean not null default true;

comment on column public.crm_oportunidades.origen is
  'manual | ia_email | whatsapp. De dónde salió la fila; ia_* significa que la escribió la IA leyendo contenido externo.';
comment on column public.crm_oportunidades.confirmada is
  'false = derivada de contenido externo y pendiente de que un humano la valide. No debe alimentar métricas ni acciones automáticas.';

create index if not exists crm_oportunidades_sin_confirmar_idx
  on public.crm_oportunidades(confirmada) where not confirmada;

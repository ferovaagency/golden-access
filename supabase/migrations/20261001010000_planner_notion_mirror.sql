-- Espejo del Planner en Notion (base `Pendientes`). Ferova One es la fuente de
-- verdad: captura, prioriza y agenda aquí; Notion recibe la fila y sus cambios.
--
-- `notion_page_id` evita duplicar la tarea en cada sincronización.
-- `notion_proyecto` guarda el nombre EXACTO de la opción del select `Proyecto`
-- en Notion para cada cliente (ej. cliente "Netpower" -> "Netpower IT"). Si está
-- vacío, la función intenta emparejar por nombre y, si no hay coincidencia
-- clara, deja el Proyecto en blanco antes que inventar una opción nueva.
ALTER TABLE public.planner_tasks
  ADD COLUMN IF NOT EXISTS notion_page_id TEXT;

ALTER TABLE public.finance_clientes
  ADD COLUMN IF NOT EXISTS notion_proyecto TEXT;

COMMENT ON COLUMN public.planner_tasks.notion_page_id IS 'Página espejo en la base Pendientes de Notion. Null = aún no publicada.';
COMMENT ON COLUMN public.finance_clientes.notion_proyecto IS 'Nombre exacto de la opción del select Proyecto en Notion para este cliente.';

CREATE INDEX IF NOT EXISTS planner_tasks_notion_page_id_idx ON public.planner_tasks (notion_page_id) WHERE notion_page_id IS NOT NULL;

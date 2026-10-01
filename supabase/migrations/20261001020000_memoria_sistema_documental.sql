-- Memoria de Ferova One · sistema documental.
--
-- Replica sobre `ferova_knowledge` el método que la empresa ya usa en Notion
-- (Bandeja de conocimiento IA · "Sistema de conocimiento · Ferova Agency"):
--   · Tipo y Área para clasificar.
--   · Estado: todo lo que escribe una IA entra "Por revisar"; sólo lo
--     "Aprobado" lo usa el asistente para responder; "Requiere decisión" espera
--     criterio humano; "Archivado" no se borra, se cierra con nota.
--   · Un tema = una página viva: cada cambio deja rastro en la bitácora.
--
-- NO cambia nada del alcance actual (del negocio / privado / Ferova interno,
-- organización, compartir arriba / publicar abajo). Lo que ya existe queda
-- "Aprobado": nada deja de funcionar.

alter table public.ferova_knowledge
  add column if not exists tipo            text not null default 'Nota',
  add column if not exists area            text,
  add column if not exists estado          text not null default 'Aprobado',
  add column if not exists enlace_origen   text,
  add column if not exists fecha_revision  date,
  add column if not exists revisado_por    uuid references auth.users(id) on delete set null,
  add column if not exists bitacora        jsonb not null default '[]'::jsonb;

alter table public.ferova_knowledge drop constraint if exists ferova_knowledge_tipo_check;
alter table public.ferova_knowledge add constraint ferova_knowledge_tipo_check
  check (tipo in ('Nota', 'Decisión', 'Proceso', 'Documento', 'Idea', 'Investigación'));

alter table public.ferova_knowledge drop constraint if exists ferova_knowledge_area_check;
alter table public.ferova_knowledge add constraint ferova_knowledge_area_check
  check (area is null or area in ('Clientes', 'Proyectos', 'Operaciones', 'Ventas', 'Desarrollo', 'Administración'));

alter table public.ferova_knowledge drop constraint if exists ferova_knowledge_estado_check;
alter table public.ferova_knowledge add constraint ferova_knowledge_estado_check
  check (estado in ('Por revisar', 'Aprobado', 'Requiere decisión', 'Archivado'));

create index if not exists ferova_knowledge_estado_idx on public.ferova_knowledge(estado);

comment on column public.ferova_knowledge.estado is 'Por revisar → Aprobado | Requiere decisión | Archivado. El asistente sólo recuerda lo Aprobado.';
comment on column public.ferova_knowledge.bitacora is 'Historial [{at, by, accion, nota}]: qué cambió y por qué. Un tema = una página viva.';

-- Búsqueda semántica: misma lógica de alcance que antes, más el filtro de
-- estado. Se recrea completa porque es SECURITY DEFINER y aquí vive el control
-- de acceso; el único cambio respecto a la versión anterior es
-- `and k.estado = 'Aprobado'`.
create or replace function public.match_ferova_knowledge(
  query_embedding text,
  match_user      uuid    default null,
  match_count     integer default 6,
  min_similarity  double precision default 0.0,
  match_org       uuid    default null
)
returns table (
  knowledge_id uuid,
  title text,
  content text,
  owner_user_id uuid,
  source text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select best.knowledge_id, best.title, best.content, best.owner_user_id, best.source, best.similarity
  from (
    select distinct on (k.id)
           k.id as knowledge_id, k.title, k.content, k.owner_user_id, k.source,
           1 - (e.embedding <=> query_embedding::vector(768)) as similarity
    from public.ferova_knowledge_embeddings e
    join public.ferova_knowledge k on k.id = e.knowledge_id
    where k.estado = 'Aprobado'
      and case
        when match_org is null then
          (k.owner_user_id is null or k.owner_user_id = match_user)
        else
          k.org_id = match_org
          or (k.compartir_arriba
              and k.org_id in (select d.id from public.org_descendants(match_org) d))
          or (k.publicar_abajo
              and match_org in (select d.id from public.org_descendants(k.org_id) d))
          or (k.org_id is null and (k.owner_user_id is null or k.owner_user_id = match_user))
      end
    order by k.id, e.embedding <=> query_embedding::vector(768)
  ) best
  where best.similarity >= min_similarity
  order by best.similarity desc
  limit match_count;
$$;

revoke all on function public.match_ferova_knowledge(text, uuid, integer, double precision, uuid) from public, anon, authenticated;
grant execute on function public.match_ferova_knowledge(text, uuid, integer, double precision, uuid) to service_role;

-- Documentación del propio sistema, en el cerebro de Ferova (sin dueño: lo ve
-- el equipo interno). Entra "Por revisar", como todo lo que escribe una IA.
-- Los embeddings los genera `brain-knowledge` al abrir la Memoria.
insert into public.ferova_knowledge (owner_user_id, title, content, source, tags, tipo, area, estado, enlace_origen)
select null,
       'Memoria · sistema documental de Ferova One',
       $doc$Una sola entrada para el conocimiento; una sola versión oficial para operar.

QUÉ ES
La Memoria es el segundo cerebro de cada negocio en Ferova One. Lo "del negocio" lo ve todo el que tenga acceso a la cuenta; lo "privado" sólo quien lo escribe; el cerebro de Ferova (sin dueño) sólo el equipo interno. Con organizaciones, una empresa puede compartir hacia arriba (al holding) y el holding publicar hacia abajo.

CLASIFICACIÓN
· Tipo: Nota, Decisión, Proceso, Documento, Idea, Investigación.
· Área: Clientes, Proyectos, Operaciones, Ventas, Desarrollo, Administración.

ESTADOS
· Por revisar: llegó información nueva (todo lo que escribe el asistente o un agente entra aquí).
· Aprobado: verificado y listo para usar. El asistente SÓLO responde con lo Aprobado.
· Requiere decisión: necesita criterio humano.
· Archivado: no aplica o está duplicado. No se borra: se archiva con nota de cierre (qué era, qué se aprendió, dónde quedó).
Lo que una persona escribe a mano queda Aprobado directamente: ella es la revisora.

REGLAS
1. Todo contenido útil entra primero por la bandeja (Por revisar).
2. No se crean tareas, clientes ni cambios comerciales desde una IA sin revisión.
3. Un tema = una página viva: si ya existe una entrada sobre el tema, se actualiza esa misma y se anota qué cambió. Sólo se crea una nueva cuando el tema es realmente distinto.
4. Cada aprendizaje indica: qué cambió, qué funcionó o no, por qué importa y cuál es el siguiente paso.
5. Toda cifra lleva fecha. Lo que no se verificó se marca PENDIENTE DE VERIFICAR.
6. No se guarda conocimiento general que el modelo ya sabe: sólo conocimiento del negocio.

CURACIÓN (trimestral, o cuando cambie una fuente o un contacto clave)
· Duplicado: conservar la más completa y reciente; archivar la otra diciendo dónde quedó la buena.
· Contradicción: se detiene y se pregunta; nunca decide sola la IA.
· Obsoleto: archivar, no borrar.
· Mal ubicado: mover a su contenedor (negocio / privado / cliente).

CIERRE DIARIO
Revisar las entradas "Por revisar" de la Memoria y decidir: aprobar, convertir en tarea, pedir decisión o archivar.

ORIGEN
Replica del método de la Bandeja de conocimiento IA de Notion (julio 2026). Ferova One es la fuente de verdad del Planner; Notion recibe el espejo de las tareas.$doc$,
       'manual', array['sistema','documentacion'], 'Proceso', 'Operaciones', 'Por revisar', 'https://app.notion.com/p/3a5d51002bf6814d8ef3ca287f283bb7'
where not exists (select 1 from public.ferova_knowledge where owner_user_id is null and title = 'Memoria · sistema documental de Ferova One');

insert into public.ferova_knowledge (owner_user_id, title, content, source, tags, tipo, area, estado)
select null,
       'Planner · modelo de interpretación de capturas (Brain dump)',
       $doc$QUÉ HACE
Convierte lo que se escribe en el Brain dump en tareas con cliente, servicio, fecha de entrega y duración, y las deja en revisión antes de crearlas. Cada tarea creada se espeja sola en la base Pendientes de Notion.

CASO QUE LO ORIGINÓ (30 sep 2026)
"el roecket: reporte mensual para mañana / Siana; tag de campañas de oliver, arreglar footer de oliver para mañana" se interpretaba como 2 tareas sin cliente, sin fecha y de 30 min. Debían ser 3 tareas (1 de El Rocket, 2 de Siana), todas para el 1 de octubre.

REGLAS DE LECTURA
1. Una línea puede traer varias tareas separadas por comas, punto y coma o "y". Nunca se inventan tareas ni se parten en pasos.
2. Lo que va antes de ":" o ";" al inicio de la línea es el cliente de todas las tareas de esa línea. Una hora ("10:30") o "https:" no cuentan como cliente.
3. Una fecha al final de la línea ("para mañana", "el viernes", "antes del 15/10", "3 de noviembre") aplica a todas las tareas de la línea que no tengan la suya.
4. Las fechas relativas se calculan en la zona horaria de la cuenta (America/Bogota). A las 10 pm en Bogotá ya es mañana en UTC: ese era un error de un día.
5. "El viernes" es el próximo viernes; si hoy es viernes, el de la semana siguiente. Un día/mes sin año que ya pasó es del año siguiente.
6. Clientes con errores de tecleo se emparejan igual ("roecket" → El Rocket). Si hay empate ("Natan" → Holding o Comercial) queda sin cliente: mejor preguntar que adivinar mal.
7. El título es la tarea sin cliente ni fecha: "Reporte mensual", no "El Rocket: reporte mensual para mañana".

QUÉ SALE DEL TEXTO Y QUÉ DE LOS DATOS
· Cliente: texto + emparejamiento contra los clientes reales.
· Servicio: la IA lo propone entre los servicios reales; se confirma en la revisión.
· Fecha de entrega: texto; fija también la fecha de agenda.
· Duración: historial real del servicio (promedio de tareas hechas con ese servicio). Sin historial, estimación de la IA anclada al historial por categoría y por cliente.
· Impacto financiero: ventas reales de los últimos 90 días por cliente (Pareto: 50 % del ingreso = 5, 80 % = 4, resto 3, sin ventas 2). La IA sólo conserva su 5 si el texto lo dice (cobrar, cerrar).
· Categoría, energía, prioridad, riesgo, facilidad: IA, 3 si no hay evidencia. Editables.

CÓMO FUNCIONA POR DENTRO
1. Parser determinista (supabase/functions/_shared/task-parser.ts, pruebas en tests/taskParser.test.ts) aplica las reglas 1-7 sin IA.
2. La IA (Gemini 2.5 Flash, una sola llamada) recibe el texto completo más ese pre-análisis y devuelve todas las tareas. Corrige sólo si el texto contradice el pre-análisis.
3. Si la IA falla o no está configurada, el pre-análisis es el resultado: cliente y fecha correctos, el resto neutro.

LA REVISIÓN ANTES DE CREAR
Por cada tarea se corrige: título, cliente, servicio (al elegirlo la duración cambia a lo que ha tomado de verdad ese servicio), fecha de entrega y duración. Lo corregido a mano manda. Al confirmar: se crean las tareas, se reorganiza la agenda por Priority Score y cada tarea nace en Pendientes.

DECISIONES
· Sin cliente antes que cliente equivocado.
· El historial del servicio pesa más que cualquier estimación de texto para la duración.
· Ferova One manda: aquí se captura y se prioriza; Notion recibe el espejo.

PENDIENTE DE VERIFICAR
Que la IA responda en producción: el resultado del 30 sep coincidía con el valor de respaldo, señal de que planner-classify no llegó a la IA en ese despliegue. Revisar el log tras el push.

Código: repo golden-access, commit f7a272d (1 oct 2026).$doc$,
       'manual', array['planner','proceso'], 'Proceso', 'Operaciones', 'Por revisar'
where not exists (select 1 from public.ferova_knowledge where owner_user_id is null and title = 'Planner · modelo de interpretación de capturas (Brain dump)');

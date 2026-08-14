# Modelo de organizaciones — holding con empresas hijas

Diseño técnico para el caso real: un holding con 4 empresas (NetPower IT,
Ferova, Fundación Altis, Natan Comercial), cada fundador con su propia
plataforma, y un cerebro del holding que se alimenta de todas y responde en
todas.

Decisiones tomadas (14 ago 2026):

| Decisión | Elegido |
|---|---|
| Visibilidad | Aislamiento estricto por empresa; el holding ve las 4; los fundadores no se ven entre sí |
| Estructura | Holding = organización padre, las 4 empresas = hijas |
| Acceso | Un login + selector de empresa en la cabecera |
| Cerebro | Sube sólo lo marcado como compartido; baja a todas las empresas |
| Aplicación | Empezar por lo no destructivo |
| Cobro | Se decide después |

---

## 1. La conclusión que cambia el plan

**El aislamiento entre fundadores ya funciona hoy.** No hace falta migrar nada
para que los 3 socios empiecen a usar la plataforma.

El sistema es mono-tenant por `user_id`: 63 de las 71 tablas llevan `user_id` y
su política RLS es `auth.uid() = user_id`. Si cada fundador se registra con su
propio correo, cada uno queda en su propia burbuja desde el primer minuto: sus
finanzas, su CRM, su Planner, su asistente. Ninguno ve al otro. Eso es
precisamente lo que pediste, y es el comportamiento por defecto.

Lo que **no** existe todavía es la capa de holding:

1. La vista consolidada del holding sobre las 4 empresas.
2. El cerebro compartido (subir lo marcado, bajar a todas).
3. Que un mismo login lleve más de un negocio con un selector.

Eso reordena el trabajo: la migración masiva de 71 tablas —la parte cara y
riesgosa— **no es un prerrequisito para arrancar**. Es lo que hay que hacer
cuando una empresa del holding tenga varios empleados compartiendo sus datos.

### El riesgo inmediato, y es de verdad

Hay un camino por el que los socios **sí** se verían entre sí: la tabla
`crm_team_members`.

Nueve tablas (`crm_oportunidades`, `crm_interacciones`, `crm_resenas`,
`crm_bot_config`, `crm_bot_knowledge`, `crm_citas_diagnostico`,
`crm_contenido_potencial`, `crm_review_sources`, `crm_acquisition_channels`) no
tienen ninguna columna de propietario: se protegen con `is_team_member()`, que
es un sí/no global. El cerebro global (`ferova_knowledge` con
`owner_user_id IS NULL`) se rige por lo mismo.

> **Regla operativa:** no agregues a los fundadores a `crm_team_members`. Ese
> allowlist es el equipo interno de Ferova (el vendedor), no los clientes. Un
> `INSERT` ahí le da a esa persona el CRM comercial completo y la memoria global
> del equipo. Es una fila de distancia entre "aislado" y "lo ve todo".

---

## 2. La palanca: `accountId` ya es la organización activa

`src/App.tsx:129`:

```ts
const accountId = collab?.ownerUserId ?? user?.id ?? '';
```

Esa variable ya se comporta como "organización activa": se pasa a
`bootstrapFinanceData`, a los nueve `save*` de finanzas y como prop `userId` a
`VentasAdmin`, `PagosEgresosAdmin` y `ConfigAdmin`. Y `effectiveUser`
(`App.tsx:133`) hace lo propio con los componentes que reciben el objeto `user`.

Esto importa mucho: el front **ya está parametrizado por inquilino**. Hay 51
`.eq('user_id', …)` y 163 payloads con `user_id:` en `src/`, pero todos beben de
ese único origen. El trabajo no es tocar 200 llamadas, es cambiar de dónde sale
`accountId`.

El bloqueo concreto para "un usuario, varios negocios" está en
`src/lib/collaboratorsService.ts:99`:

```ts
.ilike('email', email)
.maybeSingle();     // ← un usuario sólo puede pertenecer a UN dueño
```

`maybeSingle()` falla si hay más de una fila. Ese es el punto exacto que hay que
abrir para el selector.

---

## 3. Estructura de datos

```
Holding (organización padre)
├── NetPower IT      → fundador A
├── Ferova           → María Fernanda
├── Fundación Altis  → fundador C
└── Natan Comercial  → fundador D
```

Árbol, no lista plana: sumar una quinta empresa es una fila, y una empresa puede
tener sub-unidades el día que haga falta sin rehacer el modelo.

### Migración `20260814100000_organizations_base.sql` (aditiva, reversible)

```sql
-- Organizaciones en árbol. `data_user_id` es el puente con el modelo actual:
-- la cuenta cuyos datos constituyen hoy esta organización. Desaparece en Fase B,
-- cuando `org_id` sea la dimensión de tenencia canónica.
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  parent_org_id uuid references public.organizations(id) on delete restrict,
  data_user_id  uuid not null,
  created_at    timestamptz not null default now()
);
create unique index if not exists organizations_data_user_key on public.organizations(data_user_id);
create index        if not exists organizations_parent_idx    on public.organizations(parent_org_id);

-- Quién pertenece a qué organización. Arranca VACÍA: mientras no haya filas,
-- el comportamiento del sistema es idéntico al de hoy.
create table if not exists public.organization_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null,
  rol        text not null default 'colaborador' check (rol in ('owner','admin','colaborador')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists organization_members_user_idx on public.organization_members(user_id);

-- Desde qué organización está trabajando el usuario ahora mismo.
create table if not exists public.user_active_org (
  user_id    uuid primary key,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  updated_at timestamptz not null default now()
);

-- Descendientes de una organización (ella incluida). El holding "ve todo"
-- porque las 4 empresas son sus descendientes.
create or replace function public.org_descendants(root uuid)
returns table (id uuid)
language sql stable security definer set search_path = public as $$
  with recursive tree as (
    select o.id from public.organizations o where o.id = root
    union all
    select o.id from public.organizations o join tree t on o.parent_org_id = t.id
  )
  select id from tree;
$$;
```

### La función de acceso

`public.is_collaborator_of(uuid)` ya existe en el esquema, tiene `GRANT` a
`authenticated` y **no la usa ninguna política** (`20260814021752_….sql:30-46`).
Es un gancho ya construido y sin conectar. La extendemos:

```sql
-- ¿Puede quien consulta operar sobre los datos de la cuenta `owner`?
create or replace function public.can_access_account(owner uuid)
returns boolean
language sql stable security invoker set search_path = public as $$
  select
    -- 1. Es su propia cuenta.
    auth.uid() = owner
    -- 2. Es colaborador activo de esa cuenta (comportamiento actual).
    or public.is_collaborator_of(owner)
    -- 3. Manda en una organización ancestro: el holding sobre sus empresas.
    or exists (
      select 1
      from public.organization_members m
      join public.organizations hija on hija.data_user_id = owner
      where m.user_id = auth.uid()
        and m.rol in ('owner', 'admin')
        and hija.id in (select id from public.org_descendants(m.org_id))
    );
$$;
```

La rama 3 es la única nueva. **Con `organization_members` vacía no concede
nada**, así que la migración se puede aplicar en producción sin cambiar el
comportamiento de nadie: el acceso del holding se enciende cuando tú insertas
las filas, a conciencia y de a una.

---

## 4. Fases

### Fase A — no destructiva, aplicable en producción

1. La migración de arriba. No toca ninguna tabla de datos, no cambia ninguna
   política existente, no altera ninguna clave primaria.
2. Alta manual del árbol: la organización Holding, las 4 hijas y tú como
   `owner` del Holding.
3. Selector de empresa en la cabecera. Cambia `user_active_org` y, con eso,
   `accountId` en `App.tsx:129`. Requiere sustituir `getMyCollaboratorContext`
   por una versión que devuelva **la lista** de cuentas accesibles (adiós
   `maybeSingle`) y resuelva la activa.
4. Vista consolidada del holding: pantalla que suma las empresas.

   Corrección sobre la primera versión de este documento: **no** puede leerse
   desde el navegador cambiando de `accountId`. Las tablas de negocio siguen
   aisladas por `user_id = auth.uid()`, así que la RLS bloquea al holding igual
   que a cualquiera — y abrirla es justamente la Fase 7. La salida sin tocar
   ninguna política es una edge function (`holding-overview`) que usa
   `service_role` y hace la autorización explícita: sólo devuelve cuentas de
   organizaciones donde quien pregunta es `owner`/`admin`.

Con esto los 3 socios ya operan aislados y tú ves el conjunto.

**Cómo verificarlo antes de confiar en ello:** dos cuentas de prueba, A y B, con
datos distintos. A no ve nada de B en ningún módulo. Tú, desde el Holding, ves a
ambos. B deja de ver lo suyo al cambiar de empresa en el selector. Es media hora
de comprobación manual y no sustituye a las pruebas automáticas de la Fase B.

### Fase B — requiere staging y respaldo verificado

Nada de esto debe ir a producción a ciegas:

1. **`org_id` en las tablas de negocio** y reescritura de las ~55 políticas RLS
   de `user_id = auth.uid()` a la dimensión de organización. Ojo: **10 tablas de
   finanzas y `biz_crm_contactos` tienen clave primaria compuesta
   `(user_id, id)`** — cambiar la tenencia toca la PK, no un índice.
2. **Las 9 tablas `crm_*` sin columna de propietario.** Es el bloque duro.
   `crm_bot_config` es un singleton (`id boolean PK CHECK (id = true)`): admite
   exactamente una fila en todo el sistema. Multi-organización obliga a
   rediseñar esa tabla, no a añadirle una columna.
3. **RLS FORCE** (pendiente de la Fase 1 del plan de lanzamiento).
4. **Pruebas pgTAP de aislamiento** en CI: un caso por tabla × rol × lectura
   ajena × escritura ajena. Es la prueba de mayor retorno de todo el plan: sin
   ella, una migración futura rompe el aislamiento en silencio y nadie se entera.

### Bloqueo previo a la Fase B

**El repo de migraciones no refleja el esquema completo.** `collaborators`,
`project_kpis` y `project_kpi_entries` no tienen `CREATE TABLE` en
`supabase/migrations/` — se crearon desde el panel de Lovable y sólo aparecen en
`ALTER TABLE`. Antes de diseñar la migración grande hay que extraer el DDL real
del proyecto y versionarlo. Migrar contra un esquema que no conoces del todo es
como operar con los ojos vendados.

---

## 5. El cerebro del holding

Hoy hay **dos cerebros desconectados**, y conviene saberlo antes de tocar nada:

- `ferova_knowledge` + `ferova_knowledge_embeddings` (768 dims, HNSW coseno) —
  el del asistente de negocio. `owner_user_id NULL` = global del equipo; con
  valor = privado del usuario. Sólo lo consulta `business-assistant-chat`.
- `crm_bot_knowledge` — RAG aparte del bot de WhatsApp. No comparte nada con el
  anterior.

El diseño de abajo es sobre el primero. El del bot se deja como está.

### Cambio de modelo

```sql
alter table public.ferova_knowledge
  add column if not exists org_id uuid references public.organizations(id),
  -- ¿sube al holding? El valor por defecto lo fija la empresa (ver abajo).
  add column if not exists compartir_arriba boolean not null default false,
  -- ¿el holding la publica hacia sus empresas?
  add column if not exists publicar_abajo   boolean not null default false;

alter table public.organizations
  -- Interruptor por empresa: valor por defecto de `compartir_arriba` para lo
  -- que se escriba en ella. Encendido = todo sube solo, sin fricción.
  add column if not exists comparte_por_defecto boolean not null default false;
```

La búsqueda vectorial (`match_ferova_knowledge`, hoy en
`20260812180921_….sql:11-32`) cambia su única cláusula de filtro. Hoy:

```sql
where (k.owner_user_id is null or k.owner_user_id = match_user)
```

Pasa a incluir tres orígenes: lo de mi organización, lo que mis descendientes
compartieron hacia arriba, y lo que un ancestro publicó hacia abajo.

```sql
where k.org_id = match_org
   or (k.compartir_arriba and k.org_id in (select id from public.org_descendants(match_org)))
   or (k.publicar_abajo   and match_org in (select id from public.org_descendants(k.org_id)))
```

La función es `SECURITY DEFINER` y sólo tiene `GRANT EXECUTE` a `service_role`,
así que el filtro de aquí **es** el control de acceso: no hay RLS detrás que
salve un error. Es la línea más delicada de todo el diseño y merece su propia
prueba de aislamiento antes de ir a producción.

### La tensión que queda por resolver contigo

Dijiste "que el cerebro global del holding se alimente de todos los negocios de
todos los usuarios" (automático), pero elegiste "sólo lo marcado como
compartido" (por defecto no sube nada). Son dos cosas distintas y las dos son
razonables: quieres el contexto completo **y** que la nota privada de un socio no
aparezca en la respuesta de otro.

La propuesta que resuelve ambas es la columna `comparte_por_defecto` de arriba:
un interruptor **por empresa** que fija el valor por defecto de cada documento
nuevo. En Ferova y en el Holding lo dejas encendido y todo sube solo; una
empresa que prefiera control lo deja apagado y marca a mano. En ambos casos, un
documento concreto siempre se puede marcar como privado y no sale de su empresa.

**Pendiente de tu confirmación.** La alternativa —que suba todo sin excepción— es
más simple y la implemento igual de rápido; sólo hay que decidirla antes de
escribir la migración del cerebro.

---

## 6. Orden de trabajo propuesto

| # | Qué | Riesgo | Dónde |
|---|---|---|---|
| 1 | Migración `organizations_base` + `can_access_account` | Ninguno (tablas vacías) | Producción |
| 2 | Alta del árbol: Holding + 4 hijas | Ninguno | Producción |
| 3 | Selector de empresa (romper `maybeSingle`) | Bajo | Producción |
| 4 | Vista consolidada del holding | Bajo | Producción |
| 5 | Cerebro: `org_id` + `match_ferova_knowledge` | **Medio-alto** | Staging primero |
| 6 | Extraer el DDL faltante y versionarlo | Ninguno | — |
| 7 | `org_id` en tablas de negocio + RLS + PKs | **Alto** | Staging obligatorio |
| 8 | Rediseño de las 9 `crm_*` y de `crm_bot_config` | **Alto** | Staging obligatorio |
| 9 | pgTAP de aislamiento en CI | Ninguno | — |

Del 1 al 4 se puede hacer ya y desbloquea a los socios. Del 5 en adelante entra
staging, que hoy no existe: crearlo es el prerrequisito real.

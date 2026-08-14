# Fase 2 — Multi-tenant por organización

Estado: **aplicado y verificado en producción el 14 ago 2026.**

## Qué se hizo

| Pieza | Dónde |
|---|---|
| Tablas `organizations` / `organization_members` / `user_active_org`, jerarquía y `create_organization()` | `supabase/migrations/20260814120000_organizations_base.sql` |
| `my_accessible_account_ids()` + reescritura de las políticas RLS de las 44 tablas de negocio | `supabase/migrations/20260814180000_org_account_rls.sql` |
| Vuelta atrás | `rollback_org_account_rls.sql` |
| Verificación (3 bloques, sólo lee) | `verificacion_org_account_rls.sql` |

## La decisión de diseño, y por qué cambió

El borrador original (scripts `01`–`06`, borrados en este commit; están en el
historial de git) añadía una columna `org_id` a ~44 tablas, hacía backfill y
reescribía las políticas contra esa columna. Se descartó **después de leer el
esquema real**:

- 11 de esas tablas tienen **clave primaria compuesta `(user_id, id)`**. Cambiar
  la dimensión de tenencia ahí no es añadir una columna, es reescribir claves
  primarias sobre datos reales.
- El puente ya existía: `organizations.data_user_id` — la cuenta cuyos datos
  constituyen la organización. Con eso, "quién puede ver esta fila" se resuelve
  sin tocar ni una columna de datos.
- `org_id` como dimensión canónica sólo compra algo el día que UNA cuenta
  necesite contener varias tenencias distintas. Hoy la relación es 1 cuenta = 1
  empresa, así que sería trabajo caro y riesgoso a cambio de nada.

La regla quedó igual en las 44 tablas:

```sql
user_id in (select account_id from public.my_accessible_account_ids())
```

y ese conjunto son tres ramas: mi cuenta · las cuentas donde soy colaborador
activo · las cuentas de las organizaciones donde mando (el holding sobre sus
empresas, heredando hacia abajo por el árbol).

Las dos primeras ramas **son literalmente el comportamiento anterior**. Sólo la
tercera es nueva, y no concede nada mientras `organization_members` esté vacía.
Eso es lo que hizo seguro aplicarlo en producción sin staging: se verificó antes
de tocar ninguna política que la función devolvía, para los 7 usuarios reales,
exactamente una cuenta cada uno — la propia.

## Verificación que se corrió (14 ago 2026)

1. Las 44 tablas quedaron con 1 política permisiva + 1 restrictiva, todas con la
   regla nueva, y RLS activa: **44/44 ok**.
2. Haciéndose pasar por cada uno de los 7 usuarios reales (rol `authenticated` +
   su claim `sub`, igual que el navegador): la dueña ve sus 12 ventas, 48 horas,
   31 tareas y 116 contactos; los otros seis ven **0** filas suyas; y el total de
   filas ajenas visibles en el sistema es **0**.

Repetir el bloque 2 de `verificacion_org_account_rls.sql` después de cada
migración que toque RLS. Es la prueba de mayor retorno del plan y corre en
segundos.

## Lo que NO entra en esta fase (y por qué)

- **Las 9 tablas `crm_*` sin columna de propietario** (`crm_oportunidades`,
  `crm_interacciones`, `crm_resenas`, `crm_bot_config`, `crm_bot_knowledge`,
  `crm_citas_diagnostico`, `crm_contenido_potencial`, `crm_review_sources`,
  `crm_acquisition_channels`): son el CRM comercial **interno de Ferova**,
  protegido por `is_team_member()`. No son datos de cliente. `crm_bot_config`
  además es un singleton (`id boolean PK check (id = true)`): multi-organización
  obligaría a rediseñar la tabla, no a añadirle una columna. Se hace el día que
  un cliente necesite su propio bot, no antes.
- **Datos de la persona, no del negocio**: `user_subscriptions`,
  `user_notifications`, `google_workspace_connections`, `ai_usage_log`,
  `saas_user_events`, `product_feedback`, `admin_module_overrides`. La
  facturación de un socio no la ve el holding.

> **Regla operativa que no hay que romper:** no agregues a los fundadores a
> `crm_team_members`. Ese allowlist es el equipo interno de Ferova. Un `INSERT`
> ahí le da a esa persona el CRM comercial completo. Es una fila de distancia
> entre "aislado" y "lo ve todo".

## Cómo se enciende el holding

Ver `docs/DISENO_ORGANIZACIONES.md`. Resumen: crear la organización padre y las
hijas con `create_organization()`, cada hija enlazada a la cuenta de su fundador
(`data_user_id`) o invitándolo por correo (`invite_email`), y el holding con la
persona que manda como `owner`. Desde ese momento —y sólo desde ese momento— el
holding ve a sus empresas.

---

## Corrección del 14 ago (tarde): la RLS devuelve la cuenta ACTIVA, no la unión

La primera versión dejó la regla como la UNIÓN de las cuentas accesibles. Eso
rompía una suposición que atraviesa la aplicación: el código asume que la RLS ya
devuelve "mis filas", y por eso muchas consultas no filtran por `user_id`
(`plannerService` hace 35 consultas y ninguna filtra). Con la unión, en cuanto
existiera el árbol del holding, `business_profile … maybeSingle()` fallaría y las
listas del planner mezclarían empresas.

La regla quedó en `user_id = (select public.current_account_id())`:

- `current_account_id()` = la cuenta sobre la que se está trabajando, validada
  contra `my_accessible_account_ids()`.
- El conjunto accesible pasa a ser lo que debía ser: la autorización de QUÉ
  puedes activar, no lo que ves de golpe.
- Cambiar de empresa en el selector cambia lo que ve toda la aplicación, en un
  solo sitio, sin tocar una consulta.
- La vista consolidada (varias empresas a la vez) no se hace desde el navegador:
  para eso está `holding-overview`, que usa service_role y autoriza explícito.

`user_active_org` guarda ahora la CUENTA activa (`account_user_id`), no sólo la
organización: un colaborador invitado a otro negocio no tiene organización, y su
espacio de trabajo es directamente una cuenta.

**Probado contra el árbol real del holding (Natan Holding + Ferova + Netpower IT
+ Natan Comercial), dentro de una transacción que se deshace:**

1. La dueña sin cambiar de empresa ve sus 12 ventas; tiene derecho a 3 cuentas.
2. Entrando a Natan Comercial opera sobre la cuenta del socio: 1 perfil (no 2 —
   es lo que `maybeSingle()` necesita) y 0 ventas.
3. El socio ve sólo lo suyo y tiene derecho a 1 cuenta: los fundadores no se ven
   entre sí.

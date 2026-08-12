# Fase 1 — Infraestructura (lo que se hace en paneles, no en código)

El código de Fase 1 ya está hecho (aislamiento del CRM interno, sin tokens OAuth
en reposo). Esto es lo que queda, y va en los paneles de **Lovable Cloud /
Supabase**, no en el repo. Marcado quién hace qué.

> Contexto importante: el backend real es **Lovable Cloud**, que aprovisiona un
> proyecto Supabase por debajo. Entras al panel de Supabase desde Lovable
> (Cloud → Backend / “Open Supabase”). Algunos pasos son más simples que en un
> Supabase normal; otros (como staging) son más incómodos bajo Lovable — abajo
> lo digo con honestidad.

---

## 1. Proyecto de staging (para probar migraciones sin tocar datos reales)
**Por qué:** la migración grande de Fase 2 (organizaciones) NO se puede probar
por primera vez sobre tus finanzas reales. Una migración no se deshace.

**Bajo Lovable Cloud, lo pragmático:**
- Opción A (recomendada): crea un **segundo proyecto en Lovable** (un “remix” o
  proyecto nuevo vacío) que use su propia base Lovable Cloud. Ahí pruebas las
  migraciones antes de publicarlas en el real.
- Opción B: si activas **Supabase Branching** desde el panel de Supabase, cada
  rama es una copia aislada de la base. Es lo más limpio si está disponible.
- Mínimo viable: antes de CUALQUIER migración, un **respaldo verificado** (paso 3)
  tomado inmediatamente antes. Es tu red si no hay staging aún.

**Yo pongo de mi lado:** te preparo cada migración como archivo en el repo y te
digo exactamente qué revisar tras aplicarla.

---

## 2. RLS FORCE en todas las tablas + Security Advisor en cero
**Por qué:** `ENABLE` no basta. Sin `FORCE`, el dueño de la tabla ignora las
políticas, y migraciones/trabajos programados corren como dueño.

**Pasos (panel de Supabase):**
1. Panel Supabase → **Advisors → Security Advisor** → “Run”.
2. Deja la lista en **cero**. Detecta automáticamente los ~15 fallos clásicos
   (tablas sin RLS, funciones sin `search_path`, vistas `security definer`, etc.).
3. `FORCE ROW LEVEL SECURITY` por tabla lo puedo entregar como **migración**,
   PERO se prueba primero en staging (paso 1): `service_role` (las edge
   functions) sigue saltando RLS, pero FORCE puede afectar otros caminos. No lo
   aplico a ciegas sobre datos reales.

**Yo pongo de mi lado:** cuando exista staging, te armo la migración de FORCE RLS
y la corremos ahí primero.

---

## 3. Respaldo externo automático + una restauración de prueba
**Por qué:** un respaldo que nunca se restauró no es un respaldo. Y debe vivir
**fuera** de Supabase (otro proveedor), por si el problema es la cuenta misma.

**Pasos:**
1. Panel Supabase → **Database → Backups**: confirma que los backups automáticos
   están activos (y PITR si tu plan lo incluye).
2. Respaldo externo: un `pg_dump` **cifrado** subido a otro proveedor con
   versionado (ej. Backblaze B2, Cloudflare R2, o Google Drive de la empresa).
   La clave de cifrado **no debe vivir en Supabase**.
3. **Prueba de restauración, una vez, entera:** restaura ese dump en el proyecto
   de staging y confirma que la app arranca y los datos están. Sin esta prueba,
   no cuenta.

**Yo pongo de mi lado:** te doy el comando exacto de `pg_dump` cifrado y el de
restauración cuando tengas el proveedor externo elegido.

---

## 4. Sentry + alerta de caída
**Por qué:** enterarte de los fallos antes que el cliente. Es la diferencia
entre “ya lo estamos arreglando” y “gracias por avisar”.

**Pasos:**
1. Crea cuenta en **sentry.io** (plan gratis alcanza) → proyecto tipo **React**.
2. Copia el **DSN** del proyecto.
3. **Yo lo cableo en código** cuando me pases el DSN: instalo `@sentry/react`,
   inicializo en el arranque de la app, y envuelvo el ErrorBoundary. El DSN va
   como variable de entorno, no hardcodeado.
4. Alerta de caída: en Sentry, activa una **alerta** por tasa de errores; opcional
   un “uptime check” (Sentry Crons o un ping externo como UptimeRobot al dominio).

**Yo pongo de mi lado:** todo el paso 3 es código mío; solo necesito el DSN.

---

## Resumen de responsabilidades
| Paso | Tú (panel) | Yo (código) |
|---|---|---|
| 1 Staging | Crear proyecto/branch | Preparar migraciones + qué verificar |
| 2 RLS FORCE + Advisor | Correr Security Advisor, dejar en cero | Migración de FORCE (probada en staging) |
| 3 Respaldo + restauración | Elegir proveedor externo, correr la prueba | Comandos exactos de dump/restore |
| 4 Sentry | Crear cuenta, darme el DSN, activar alerta | Instalar y cablear Sentry en la app |

Cuando quieras, arrancamos por el que prefieras. El más urgente antes de la
migración de Fase 2 es **staging + respaldo verificado**.

# Migraciones: por qué el repo puede ir por delante de la base

Hay dos clases de migración en `supabase/migrations/`, y **no se aplican igual**:

| Nombre | Quién la escribe | ¿Se aplica sola? |
|---|---|---|
| `20260814021752_934ce9fd-….sql` (UUID) | Lovable | Sí, al generarla |
| `20260813140000_biz_crm_contactos_campos.sql` (descriptivo) | A mano, en el repo | **No.** Hacer push no la ejecuta |

Un `git push` despliega el código, pero no corre el SQL escrito a mano. El
resultado es una base que va por detrás del código: la aplicación consulta una
columna que en producción no existe y la pantalla revienta con
`column … does not exist`.

Fue exactamente lo que pasó el 14 ago 2026 con `crm_resenas.confirmada`
(Reseñas y el asistente) y `business_profile.deletion_scheduled_for` (borrado de
cuenta y su cron).

## Qué hacer

1. Ejecuta `00_diagnostico.sql` en el editor SQL de Supabase. Sólo lee: te dice
   qué objetos faltan.
2. Si falta algo, ejecuta `01_aplicar_pendientes.sql`. Es la concatenación
   literal de las migraciones a mano, todas idempotentes (`if not exists` /
   `create or replace`), así que correrlo entero es seguro aunque parte ya esté
   aplicada.

## Al añadir una migración a mano

Escríbela idempotente y aplícala tú en el editor SQL (o pídeselo a Lovable) en
cuanto la subas. Si no, el código llega a producción antes que su esquema.

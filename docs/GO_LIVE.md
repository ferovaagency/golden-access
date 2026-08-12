# Go-live — pasos finales para cobrar y salir

El código está listo (Paddle, Sentry, purga de cuentas, RLS FORCE, todo lo del
plan). Falta solo configuración de paneles y una prueba. Marca cada punto.

## 1. Paddle: webhook + secreto (SIN esto, nadie se activa) — CRÍTICO
1. En el panel de Paddle → **Developer Tools → Notifications** → crea una
   *destination* apuntando a:
   `https://izkhdzzyqfopjveaagwk.supabase.co/functions/v1/paddle-webhook`
2. Suscríbela a los eventos: `transaction.completed`, `subscription.activated`,
   `subscription.canceled`, `subscription.paused`, `subscription.resumed`.
3. Copia la **secret key** de esa destination.
4. Guárdala como **secreto de Supabase** (backend, no VITE_): `PADDLE_WEBHOOK_SECRET`.
   - Si falta, el webhook responde 503 y ninguna compra activa la cuenta.

## 2. Sentry: DSN
- Agrega a `.env` (junto a las VITE_PADDLE_*):
  `VITE_SENTRY_DSN=https://6286193aab6e053e9f0afa885af5c376@o4511900282191872.ingest.us.sentry.io/4511900299493376`
- No hay que tocar código: `src/lib/observability.ts` ya lo lee y se activa en el
  próximo build. Para probar, provoca un error y revisa que aparezca en Sentry.

## 3. Purga de cuentas: programar el cron
- La función `purge-deleted-accounts` ya existe y usa `CRON_SECRET`.
- Programa un job diario (Supabase Scheduled Functions o pg_cron + pg_net) que haga
  POST a
  `https://izkhdzzyqfopjveaagwk.supabase.co/functions/v1/purge-deleted-accounts`
  con la cabecera `x-cron-secret: <CRON_SECRET>`.
- Sin el cron, las cuentas quedan marcadas para borrar pero no se purgan solas.

## 4. Prueba del flujo de dinero (en SANDBOX, no en producción)
1. Pon temporalmente `VITE_PADDLE_ENV=sandbox` con un token y price de sandbox.
2. Haz una compra de prueba y confirma:
   - El webhook recibe el evento (revisa logs de la función).
   - Se crea la fila en `user_subscriptions` con `status='active'`, `provider='paddle'`.
   - El Paywall detecta la activación (polling) y da acceso.
   - Un segundo envío del mismo evento responde `duplicate` (idempotencia).
3. **Si la activación NO ocurre**, el primer sospechoso es el `upsert` del webhook
   contra el índice único parcial `(provider, provider_order_id)`: verifica en los
   logs si hay error de "ON CONFLICT". Si aparece, se resuelve con un índice único
   total o ajustando el onConflict.
4. Vuelve a `VITE_PADDLE_ENV=production` para salir en vivo.

## 5. Antes de escalar (no bloquea la primera venta)
- **Security Advisor** de Supabase en cero.
- **Staging + backup verificado** antes de aplicar la **Fase 2 (organizaciones)**
  y cualquier migración grande (ver docs/PLAN_LANZAMIENTO_ESTADO.md).
- Confirmar el tratamiento fiscal con el contador (exportación de servicios).

## Estado de la Fase 2 (organizaciones)
Diseñada y lista en docs/PLAN_LANZAMIENTO_ESTADO.md, **sin aplicar** (necesita
staging). Hoy el sistema es mono-tenant por `user_id`: cada cliente-dueño ya está
aislado, así que no bloquea las primeras ventas. Se aplica cuando un cliente tenga
varios colaboradores compartiendo datos.

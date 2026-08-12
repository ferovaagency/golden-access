# Prompt para Lovable — trabajo de lanzamiento de Ferova One

Copia el bloque de abajo y pégalo en el chat de Lovable. Está pensado para que
Lovable haga lo que necesita su entorno (backend, dependencias, secretos,
integraciones y migraciones contra la base real). El detalle y el diseño están
en `docs/PLAN_LANZAMIENTO_ESTADO.md` del repo.

> Sugerencia: envíalo por partes (una tarea por mensaje) si Lovable se satura.
> La #1 (Paddle) es la más grande; puede ir sola.

---

```
Contexto: este proyecto (Ferova One) sale a producción. Sigue el plan de
lanzamiento; el estado y el diseño detallado están en
docs/PLAN_LANZAMIENTO_ESTADO.md. Regla dura: NO rompas datos ni funciones.
Antes de cualquier migración destructiva, haz un respaldo verificado. Prueba en
sandbox lo que se pueda antes de producción.

1) PASARELA DE PAGOS: MIGRAR DE PAYPAL A PADDLE (prioridad alta)
El plan define Paddle como Merchant of Record (Paddle es el vendedor frente al
cliente y gestiona cobro, facturación, impuestos, reembolsos y disputas). Hoy el
código usa PayPal. Migra a Paddle Billing:
- Retira/deshabilita la integración de PayPal: edge functions paypal-webhook y
  paypal-confirm-subscription, y src/lib/paymentProvider.ts (PAYPAL_PLAN_ID, botones).
- Implementa el checkout de Paddle (Paddle.js overlay o checkout alojado) en el
  flujo de suscripción.
- Crea una edge function de webhook de Paddle con verificación de firma
  (Paddle-Signature) e idempotencia. Ya existe la tabla paddle_webhook_events y la
  columna user_subscriptions.paddle_customer_id: úsalas.
- Activa la suscripción (user_subscriptions.status='active', plan, paddle_customer_id)
  al recibir los eventos de Paddle (transaction.completed / subscription.activated),
  y desactívala en subscription.canceled.
- Pide los secretos que necesites (Paddle API key, client-side token, webhook
  secret, product/price IDs) y déjalos como variables de entorno, nunca hardcodeados.
- Incorpora el ~5% de Paddle al precio de lista (no lo absorbas).
- Las páginas legales (/terminos, /privacidad, /reembolsos, /subencargados) YA
  referencian a Paddle como Merchant of Record; verifica que quede consistente y
  que el nombre legal (María Fernanda Calderón — Ferova Agency) aparezca dentro de
  los Términos, como exige Paddle.

2) SECRETOS
- Agrega APOLLO_API_KEY a los secretos de Supabase (recupera la edge function
  apollo-enrich-playbook, que hoy responde 503 sin la key).
- Agrega VITE_SENTRY_DSN (para el punto 3).

3) SENTRY (observabilidad)
- Instala la dependencia @sentry/react.
- Crea src/lib/observability.ts con una función initObservability() que lea
  import.meta.env.VITE_SENTRY_DSN; si no hay DSN, que sea no-op. Si hay, inicializa
  Sentry con environment=import.meta.env.MODE y tracesSampleRate 0.1.
- Llama initObservability() en src/main.tsx antes de createRoot.
- Configura en Sentry una alerta por tasa de errores.

4) SEGURIDAD DE LA BASE DE DATOS
- Corre el Security Advisor de Supabase y déjalo en CERO (tablas sin RLS,
  funciones sin search_path, vistas security definer, etc.).
- Aplica FORCE ROW LEVEL SECURITY a todas las tablas de negocio de public
  (finance_*, crm_*, planner_*, ferova_knowledge, etc.). Haz respaldo verificado
  antes y confirma con dos usuarios de prueba A/B que ninguno ve datos del otro.

5) PURGA DEL BORRADO DE CUENTA (con período de gracia)
Ya existe el flujo self-service: business_profile.deletion_requested_at /
deletion_scheduled_for se setean cuando el usuario pide eliminar su cuenta. Falta
la purga real:
- Crea un cron (Supabase Scheduled) que a diario busque business_profile con
  deletion_scheduled_for < now() y purgue esas cuentas.
- Reutiliza la lógica de admin-delete-customer y AÑADE el borrado explícito de los
  embeddings del cerebro: borra ferova_knowledge_embeddings de los knowledge_id del
  usuario, y luego ferova_knowledge por owner_user_id.

6) (OPCIONAL, MÁS ADELANTE — requiere staging y respaldo) MODELO DE ORGANIZACIONES
Multi-tenant por organización (hoy es mono-tenant por user_id). El diseño completo
(tablas organizations/organization_members, user_active_org, current_org_id, org_id
en las tablas, reescritura de RLS con políticas restrictive, filtro por org en
match_ferova_knowledge, y pruebas pgTAP de aislamiento) está en
docs/PLAN_LANZAMIENTO_ESTADO.md. No lo hagas sobre datos reales sin respaldo y
verificación de aislamiento.
```

---

## Qué hace Ferova (no Lovable)
- Crear la cuenta de **Paddle** y completar sus verificaciones (dominio, negocio,
  identidad); darle a Lovable las keys de Paddle.
- Crear la cuenta de **Sentry** y pasar el DSN.
- Pegar **APOLLO_API_KEY**.
- Decidir precio final con el ~5% de Paddle incorporado, y trial/grandfathering.

# Migración a Lovable Cloud (con Google login integrado)

## Objetivo

Activar Lovable Cloud en este proyecto para tener el mismo Google login "un click" que Ferova AI Studio, **sin tocar tu Supabase actual** (donde viven datos de otros proyectos).

## Cómo queda la arquitectura

```text
ANTES                          DESPUÉS
─────                          ───────
Tu Supabase externo            Tu Supabase externo (INTACTO)
├── finance_*                  ├── (queda ahí sin cambios,
├── crm_*                      │    otros proyectos siguen
├── user_subscriptions         │    usándolo)
└── auth.users                 └── auth.users
       ↑
       └── Ferova OS lee/escribe          Lovable Cloud (NUEVO)
                                          ├── finance_* (copiados)
                                          ├── crm_* (copiados)
                                          ├── user_subscriptions
                                          ├── auth.users (Google login OOB)
                                          └── Edge functions
                                                 ↑
                                                 └── Ferova OS lee/escribe
```

**Tu Supabase actual no se toca**. Se crea un Supabase nuevo administrado por Lovable, se copian las 18 tablas que **solo** usa este proyecto, y Ferova OS pasa a apuntar al nuevo.

## Tablas a migrar (solo las de este proyecto)

Detectadas en el código:

- **Finance (10)**: `finance_ventas`, `finance_clientes`, `finance_servicios`, `finance_horas`, `finance_abonos`, `finance_otros_gastos`, `finance_pagos_egresos`, `finance_herramientas`, `finance_herramienta_servicios`, `finance_config`
- **CRM (7)**: `crm_oportunidades`, `crm_interacciones`, `crm_citas_diagnostico`, `crm_contenido_potencial`, `crm_team_members`, `crm_bot_config`, `crm_bot_knowledge`
- **Suscripciones (1)**: `user_subscriptions`

Confirmame que **ninguna de estas 18 tablas es leída/escrita por otro de tus proyectos**. Si alguna es compartida, la marcamos y decidimos qué hacer (dejarla en el Supabase externo con acceso cross-project, o duplicar datos).

## Pasos

### 1. Activar Lovable Cloud
`supabase--enable` → crea el nuevo Supabase managed con auth + Google login ya configurados (así como AI Studio).

### 2. Recrear el esquema en Lovable Cloud
Genero migración con las 18 tablas exactas (columnas, tipos, FKs, índices, triggers, RLS policies, grants) leyendo primero el esquema real de tu Supabase actual vía las edge functions o pidiéndote un dump.

**Necesito**: acceso SQL de solo lectura a tu Supabase actual para copiar el esquema fielmente. Dos opciones:
- (a) Corrés `pg_dump --schema-only` de esas tablas y me pegás el SQL.
- (b) Me das temporalmente la connection string y lo hago yo con `psql` desde el sandbox.

### 3. Migrar los datos
- Export `COPY (SELECT * FROM tabla) TO STDOUT WITH CSV` desde tu Supabase.
- Import a Lovable Cloud vía tool `insert`.
- **Los `user_id` de `auth.users` cambian** porque son cuentas nuevas. Estrategia: mapping table — para cada email en tu `auth.users` viejo, se crea el usuario equivalente en Lovable Cloud y se reescriben todos los `user_id` de las 18 tablas con el nuevo UUID antes de insertar.

### 4. Reescribir `src/lib/supabase.ts`
Reemplazo el cliente actual por el cliente auto-generado de Lovable Cloud (`src/integrations/lovable/client.ts`). El código de `financeService.ts`, `crmService.ts`, componentes: **sin cambios** (usan `supabase.from(...)`, misma API).

### 5. Rehacer las 7 edge functions
`paypal-ipn`, `paypal-capture-order`, `calendar-book`, `calendar-cancel`, `linkedin-analyze`, `whatsapp-send`, `whatsapp-webhook`, `bot-knowledge-upsert` se redeployan en Lovable Cloud. El código es idéntico salvo variables de entorno.

### 6. Reconfigurar secretos
- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `PAYPAL_WEBHOOK_ID`
- WhatsApp/Meta: los que tengas hoy
- Google Calendar: reconecto el connector
- `LOVABLE_API_KEY` para AI Gateway (linkedin-analyze) — auto-provisionado

### 7. Actualizar webhooks externos
- **PayPal Dashboard**: cambiar URL del IPN al nuevo endpoint de Lovable Cloud.
- **WhatsApp/Meta**: cambiar callback URL del webhook.

### 8. Verificación
- Login con Google desde el preview.
- Cargar Dashboard, VentasAdmin, CRM y confirmar que los datos se ven.
- Test de un pago PayPal en sandbox.
- Cuando confirmes que todo funciona → apagamos las escrituras al Supabase viejo desde este proyecto (queda como archivo de referencia).

## Riesgos y advertencias

- **Ventana de escritura dual**: entre la exportación y el switch, cualquier venta/gasto que cargues en el Supabase viejo se pierde. Recomiendo hacer la migración en horario bajo y con la app en "modo mantenimiento" (te muestro un banner) por ~30 min.
- **PayPal en producción**: si tenés suscripciones activas cobrando ahora, la URL del IPN cambia. Los pagos que ocurran mientras cambiás la config podrían no registrarse. Sugiero pausar el plan en PayPal durante la ventana.
- **Google Sheets**: seguirá funcionando igual (el `provider_token` se obtiene del OAuth de Google en Lovable Cloud, mismos scopes).
- **`sb_publishable_b5j2ar7b9fz2XNr95JwYCQ_Eyasabcn`** (tu clave actual) queda obsoleta para este proyecto pero **sigue viva** para los otros proyectos que usan ese Supabase.

## Detalles técnicos

- **Cliente Supabase**: Lovable Cloud usa `@supabase/supabase-js` estándar; la API `from().select()` es idéntica → los servicios no cambian.
- **Auth mapping**: crear tabla temporal `auth_id_map(old_id uuid, new_id uuid, email text)` en el nuevo Supabase, poblarla con INSERT USER via admin API por email, y usar UPDATE con JOIN para reescribir FKs.
- **RLS**: se replican las policies existentes; como los `user_id` cambian pero mantenemos la asociación email→user, las policies `auth.uid() = user_id` siguen siendo correctas post-mapping.
- **Storage**: no detecté uso de storage buckets en el código; si tenés archivos en el Supabase viejo, decime y los agrego a la migración.

## Estimación

- Setup + esquema: ~30 min
- Datos + auth mapping: ~1 h (depende del volumen)
- Edge functions + secretos: ~45 min
- Webhooks externos + smoke test: ~30 min

**Total: ~3 h de trabajo, con la app operativa al final.**

---

## Antes de arrancar necesito confirmación de 3 cosas

1. ¿Las 18 tablas listadas son **exclusivas** de este proyecto? ¿O alguna es compartida?
2. ¿Preferís opción (a) pg_dump manual o (b) me pasás connection string temporal?
3. ¿Hay suscripciones PayPal activas cobrando ahora (impacta la ventana de mantenimiento)?

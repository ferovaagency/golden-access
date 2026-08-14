# Plan de lanzamiento — estado real

Auditoría del repo y de la **base viva** contra `Ferova-One-Plan-Lanzamiento.html`
(8 fases). Actualizado el **14 de agosto de 2026**, cuando se cerró el código de
las 8 fases.

Regla que se siguió: nada se dio por hecho sin comprobarlo contra la base real.
Todo lo que dice "verificado" abajo se ejecutó y se leyó el resultado.

---

## Resumen por fase

| Fase | Código | Qué falta (y de quién es) |
|---|---|---|
| 1 Seguridad / no filtrar | ✅ Cerrada | Advisor de Supabase en cero + respaldos externos con restauración de prueba (**tuyo, panel**) |
| 2 Organizaciones | ✅ Cerrada y verificada en producción | Dar de alta el árbol del holding cuando quieras encenderlo |
| 3 Recuperar módulos | ✅ Cerrada | Pegar `APOLLO_API_KEY` en secretos (**tuyo, panel**) |
| 4 Costo por usuario | ✅ Cerrada | Ajustar el umbral de similitud cuando haya datos reales |
| 5 Legal / cobrar | ✅ Código cerrado | Aprobación de Paddle, contador y **validación legal de los textos** (**tuyo / abogado**) |
| 6 Confianza | ✅ Cerrada | — |
| 7 Precio | Página y planes existen | Trial, absorber comisión, grandfathering: **decisión tuya** |
| 8 Vender | ✅ Código y proceso listos | La compra de prueba de extremo a extremo (**tuya**, ver `GO_LIVE.md`) |

---

## Fase 1 — Seguridad

- Auditoría de las 41 edge functions: 0 fugas desde el body.
- `crm_oportunidades` / `crm_resenas` (CRM interno compartido) dejaron de
  filtrarse a los informes de clientes.
- No hay tokens OAuth en reposo: el de Google vive sólo en la sesión del
  navegador. La columna muerta `access_token` se eliminó.
- **RLS FORCE en las 74 tablas** (`20260814200000_rls_force.sql`). La auditoría
  previa descartó el riesgo real: las 3 vistas son `security_invoker=true`,
  ninguna función `SECURITY DEFINER` toca las 44 tablas de negocio, y el único
  cron que sí las toca corre como `postgres`, que tiene BYPASSRLS. Efecto
  práctico hoy: ninguno. Es la red para cuando aparezca un rol nuevo.
- Observabilidad: `initObservability` se engancha a `logger.onError`, así que
  todo lo que ya pasa por `logger.error` (incluido el ErrorBoundary) llega a
  Sentry, con usuario y empresa activa. **Sin DSN es un no-op** → pega el DSN en
  `VITE_SENTRY_DSN` y empieza a reportar.

**Pendiente tuyo (panel):** Security Advisor en cero, respaldos externos con una
restauración de prueba, y el DSN de Sentry.

## Fase 2 — Organizaciones

Cerrada y **verificada en producción**. Ver `docs/fase2/README.md` para el
detalle y `docs/DISENO_ORGANIZACIONES.md` para el diseño.

Lo esencial: la regla de acceso de las 44 tablas de negocio pasó a
`user_id in (select account_id from my_accessible_account_ids())`, que son tres
ramas — mi cuenta, las cuentas donde soy colaborador activo, y las cuentas de las
organizaciones donde mando. Las dos primeras son el comportamiento anterior; la
tercera no concede nada hasta que des de alta el árbol.

Se descartó añadir `org_id` a las 44 tablas: 11 tienen clave primaria compuesta
`(user_id, id)` y `organizations.data_user_id` ya resuelve la tenencia sin tocar
una sola columna de datos.

En el servidor, la empresa activa se resuelve en la base
(`active_context_for_user`), no desde la petición: el asistente, los informes y
el cerebro responden sobre la empresa que tengas seleccionada.

**Verificación (14 ago):** 44/44 tablas con política permisiva + restrictiva;
haciéndose pasar por los 7 usuarios reales, la dueña conserva sus 12 ventas / 48
horas / 31 tareas / 116 contactos, los otros seis ven 0, y el total de filas
ajenas visibles es **0**.

## Fase 3 — Módulos

Todo recuperado. Falta una sola cosa y es la de mayor retorno del plan: **pegar
`APOLLO_API_KEY`** en los secretos de Supabase (10 minutos) para encender
`apollo-enrich-playbook`.

## Fase 4 — Costo por usuario

`ai_usage_log` + `admin_ai_usage_overview` (p95 por usuario y por llamada) y la
cobertura ya está **completa**: los 9 caminos que llamaban al modelo sin dejar
rastro ahora registran. En los bucles se guarda una fila por invocación, no una
por iteración, para no romper el percentil por llamada.

**Pendiente, con datos:** subir el umbral de similitud del cerebro (hoy 0.25). No
se toca a ciegas — el troceo cambió la dinámica; hay que dejar que se acumulen
recalls reales y ajustar con evidencia.

## Fase 5 — Cobrar

Paddle está en el código (webhook con HMAC, comparación en tiempo constante,
ventana de desfase e idempotencia). Se corrigió que al cancelar sólo se buscara
por el id de la suscripción, lo que dejaba viva la fila creada por
`transaction.completed` y permitía seguir entrando después de cancelar.

La regla de acceso se extrajo a `src/lib/accessRules.ts` con prueba automática:
una suscripción activa pero vencida **no** da acceso.

**Pendiente tuyo:** aprobación de Paddle, contador (IVA art. 481 c, RUT
exportador, facturación electrónica) y que un abogado valide los textos legales.
Yo no doy asesoría legal: los borradores están, la validación no es mía.

## Fase 6 — Confianza

- `/seguridad`, `/reembolsos`, `/subencargados`, `/novedades` y export integral
  en JSON, todo enlazado.
- Borrado self-service con período de gracia + purga por cron (incluye
  embeddings).
- **Se cerró un agujero real:** `business_assistant_messages` (las
  conversaciones con el asistente), `project_kpis` y `project_kpi_entries` no
  tenían llave a `auth.users`, así que sobrevivían al borrado de la cuenta. Ahora
  caen en cascada como las otras 45.
- **Confirmación humana:** lo que la IA deduce de un correo queda marcado y no se
  propaga hasta que un humano lo valide — ya estaba en reseñas, ahora también en
  oportunidades (`sortlist-leads-scan`), y `loadBIContext` dejó de contar
  reseñas sin confirmar.
- **Registro del agente:** las cinco herramientas de escritura del asistente
  dejan fila en `audit_log` con `actor='asistente'`.
- Revocación de terceros: no hay nada que revocar porque no se guardan tokens
  (ver Fase 1). Si algún día se guardan, el sitio es la purga.

## Fase 7 — Precio

La página y los planes existen. Lo que queda es **decisión tuya**: prueba de 14
días con tarjeta (sí/no), absorber o no la comisión de la pasarela en el precio,
grandfathering de fundadores, y los términos exactos de reembolso. Hay borradores
razonables en `Terminos.tsx` y en el historial de este documento.

## Fase 8 — Vender

Changelog, evento de activación y proceso de incidentes (`INCIDENTES.md`) están.
La compra de prueba de extremo a extremo es tuya y está paso a paso en
`GO_LIVE.md`.

---

## Lo que el plan dice NO hacer todavía (y sigue siendo correcto)

SOC 2 / ISO 27001, apps móviles, app de escritorio, SLA contractual, búsqueda
híbrida con reranking, panel de soporte entre organizaciones, página de estado,
rediseño visual. Todo eso vale más con 10 clientes que con cero.

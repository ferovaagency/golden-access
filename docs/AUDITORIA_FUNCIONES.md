# Auditoría de funciones (pre-lanzamiento)

Revisión de las ~47 edge functions, config y frontend. Autenticación verificada
sólida (todas derivan identidad del JWT; ninguna confía en user_id del body; las
admin-* exigen rol owner). Pagos Paddle correctos (firma HMAC, idempotencia,
índice único). Abajo: lo corregido en esta sesión y lo que queda por revisar.

## ✅ Corregido
- **whatsapp-webhook — verify_jwt** (ALTA): faltaba `[functions.whatsapp-webhook] verify_jwt=false` en config.toml; sin él la plataforma rechazaba con 401 todo mensaje entrante. Agregado.
- **whatsapp-webhook — idempotencia** (ALTA): ante reintento de Evolution, se volvía a llamar la IA y a responder. Ahora corta en duplicado (23505) sin re-responder.
- **reviews-scan / sortlist-leads-scan — IA en loop** (MEDIA): un fallo puntual de IA (p. ej. 429) abortaba TODO el escaneo (`return`). Ahora se salta el ítem (`continue`).
- **reviews-scan — fecha inválida** (MEDIA): `new Date(dateHdr).toISOString()` podía lanzar y tumbar la función; ahora valida la fecha.
- **admin-delete-customer / purge-deleted-accounts — email case-sensitive** (MEDIA, seguridad): la salvaguarda "no borrar a un miembro del equipo" comparaba email crudo; con distinto case podía fallar (fail-open). Ahora usa `ilike`.

## ⏳ Pendiente (revisar; ninguno bloquea recibir pagos)
- **Paddle cancela acceso al instante** (MEDIA): `subscription.canceled/paused` → `cancelled` inmediato; un cliente que ya pagó el mes pierde acceso al cancelar antes de fin de período. Requiere conocer el ciclo exacto de Paddle (¿`canceled` dispara al final del período o al instante?) y, si aplica, conservar acceso hasta `current_billing_period.ends_at` (guardar `expires_at` y que `checkSubscription` lo respete). No se tocó para no introducir un bug de facturación sin poder probarlo.
- **admin-* grants de cortesía case-sensitive** (MEDIA): `admin-revoke-access`, `admin-set-plan`, `admin-delete-customer` comparan email de cortesía sin `lower()`; con distinto case pueden no revocar/aplicar. Normalizar a minúsculas.
- **brain-knowledge sin embeddings en silencio** (MEDIA): sin `LOVABLE_API_KEY`, guarda la nota pero sin vectores (invisible a la búsqueda) y responde ok. Confirmar que la key está seteada; idealmente avisar si falta.
- **admin-analytics-deep** (MEDIA): 14 queries sin chequear error (métricas sobre vacío si una falla); `saas_user_events` con `.limit(5000)` global; `listUsers({perPage:1000})` sin paginar (>1000 usuarios se pierden).
- **bot-knowledge-upsert / whatsapp embeddings — dims 768** (MEDIA): se asume 768 dims; `gemini-embedding-001` devuelve 3072 por defecto. Verificar que el gateway recorta a 768 o pasar `output_dimensionality`.
- **Duplicados por campo no único** (MEDIA): `crm_oportunidades ... .eq('telefono', x).maybeSingle()` (whatsapp) y por email (calendar-book) pueden crear duplicados si hay 2+ filas. Acotar u ordenar+limit(1).
- **apollo-import-list dedup >1000** (MEDIA): select sin limit topa en 1000 y reimporta duplicados.
- **calendar-book** (MEDIA): crea el evento en Google Calendar (con invitación) antes del insert; si el insert falla, evento huérfano.
- **Varios BAJA**: status 200 en errores (whatsapp-send/connect, linkedin-search), body inválido → 500 en vez de 400 en admin-*, `linkedin-analyze score_potencial` sin clamp, `calendar-cancel` sin validar keys, `onboarding-chat` recálculo de completado, `bi-*`/`calendar-sync-bookings` no soportan x-cron-secret (no agendables sin sesión).

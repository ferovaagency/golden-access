# Ferova OS — AI Behavior

## Propósito

La IA existente asiste al usuario; no es una fuente autónoma de verdad ni ejecuta decisiones de negocio sin una acción posterior autorizada.

## Casos implementados

| Capacidad | Implementación |
|---|---|
| Asistente de negocio | `business-assistant-chat` y UI de asistente |
| Onboarding | `onboarding-chat` |
| Planner | `planner-classify`, `planner-plan-day`, `planner-insights` |
| BI | `bi-compute-health`, `bi-detect-blindspots` |
| Dirección | `ceo-report-generate`, `decision-simulate` |
| CRM | enriquecimiento Apollo, análisis LinkedIn, bot/knowledge, WhatsApp y reviews |

La mayor parte de estas funciones usa Lovable AI Gateway; el bot de WhatsApp usa Gemini a través del gateway y embeddings para recuperar conocimiento.

## Contrato de comportamiento

1. No inventar datos financieros, contactos, hechos de CRM ni políticas del negocio.
2. Presentar resultados como asistencia, recomendación, clasificación, resumen o simulación; no como decisión irreversible.
3. Usar únicamente el contexto del usuario/tenant autorizado para la solicitud.
4. Mantener trazabilidad cuando una salida se persiste: input, resultado, usuario y fecha cuando el esquema lo permita.
5. Limitar tamaño de contexto, costo, reintentos y errores de proveedor.
6. No exponer claves, tokens, prompts internos sensibles ni datos de otros usuarios.
7. La IA no puede modificar permisos, planes, datos financieros o información externa sin un flujo explícito autorizado.

## Datos y privacidad

- El contexto financiero, de CRM y Planner puede contener datos personales y comerciales.
- Las funciones deben minimizar contexto, filtrar secretos y respetar RLS/ownership antes de llamar al proveedor.
- Los proveedores externos son dependencias: una respuesta fallida no debe bloquear una operación financiera básica.

## UX de IA

- Mostrar estado de carga, error y posibilidad de reintento.
- Distinguir claramente contenido generado de datos registrados.
- Solicitar confirmación antes de aplicar una sugerencia a una operación material.
- Conservar una salida segura cuando IA o integración no estén disponibles.

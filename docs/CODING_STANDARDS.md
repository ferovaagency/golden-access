# Ferova OS — Coding Standards

## Principios

1. TypeScript primero; evitar `any` y tipar límites de API, DB e integraciones.
2. Componentes presentan; servicios de dominio persisten; Edge Functions integran y privilegian.
3. No introducir secretos en frontend, repositorio, logs ni errores expuestos al usuario.
4. Cambios pequeños, revisables y compatibles con el modelo de acceso existente.

## Frontend

- Usar componentes funcionales, hooks y estados explícitos de loading/error/empty.
- Mantener componentes enfocados; extraer subcomponentes, hooks o servicios cuando mezclen dominio, fetch y presentación.
- No añadir acceso directo a tablas desde componentes si existe o corresponde un servicio.
- Preferir rutas para pantallas independientes; no ampliar indefinidamente la navegación tab-based del shell.
- Usar `ErrorBoundary`, logger y mensajes de UI consistentes; evitar nuevos `alert`/`confirm` como patrón general.

## Datos y backend

- Todo cambio de esquema entra en una migración versionada.
- Toda tabla con datos de usuario debe tener RLS y políticas verificadas.
- Una Edge Function con service role debe validar identidad, rol y ownership antes de operar.
- Validar input en límites de red; usar Zod cuando corresponda al contrato existente.
- Diseñar idempotencia para webhooks y pagos.

## IA e integraciones

- Centralizar credenciales en variables de entorno del servidor.
- Pasar solo el contexto mínimo necesario al proveedor.
- Definir timeout, manejo de error y límite de tasa antes de exponer una integración a UI.
- Nunca confiar en output de IA como autorización.

## Calidad

- Ejecutar `npm run lint` antes de entregar cambios TypeScript.
- Añadir pruebas a cálculos, reglas de acceso, normalización, webhooks y servicios críticos.
- Mantener un único gestor de paquetes/lockfile cuando se haga la limpieza planificada.
- Documentar decisiones arquitectónicas que cambien este conjunto de documentos.

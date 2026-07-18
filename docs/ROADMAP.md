# Ferova OS — Architecture Roadmap

> Roadmap técnico basado en el producto implementado. No agrega nuevas líneas de producto; ordena la consolidación del sistema actual.

## Fase 0 — Seguridad crítica

- Eliminar la persistencia navegador/base de datos de tokens OAuth reutilizables de Google; mover el manejo de credenciales a un límite servidor cifrado.
- Endurecer PayPal IPN: validar receptor, moneda, importe/plan esperado e idempotencia.
- Reemplazar token de WhatsApp en query string por verificación firmada en header y protección contra replay.
- Auditar RLS, roles y Edge Functions con service role.

**Salida:** modelo de credenciales y autorización revisado; pruebas de pago/webhook y matriz de permisos.

## Fase 1 — Fundaciones de calidad

- Añadir pruebas de cálculos financieros, planes, acceso, servicios y normalización.
- Estandarizar estados de error/carga y observabilidad de funciones/IA.
- Reducir `any` en límites de servicios y funciones.
- Resolver estrategia única de package manager y lockfile.

**Salida:** CI de tipo/pruebas y contratos básicos de servicios.

## Fase 2 — Arquitectura frontend

- Convertir módulos del shell en rutas lazy con guards de plan/rol.
- Extraer autenticación/acceso, bootstrap financiero y navegación de `App.tsx`.
- Adoptar una capa coherente de estado remoto, caché e invalidación.

**Salida:** rutas deep-linkables y shell de carga reducido.

## Fase 3 — Modularización de dominio

- Separar Finanzas, CRM interno, CRM cliente, Planner, BI y Reports por feature.
- Descomponer `AdminCRM.tsx` y `sheetsService.ts`.
- Crear primitives reutilizables de formularios, tablas, mutaciones y notificaciones.

**Salida:** dominios independientes y componentes mantenibles.

## Fase 4 — Datos y rendimiento

- Paginar consultas financieras/CRM.
- Mover agregados de dashboard/reportes a consultas server-side cuando el volumen lo requiera.
- Revisar índices por usuario, fecha, estado y relaciones.
- Virtualizar tablas de alto volumen y medir latencia/costo de IA.

**Salida:** comportamiento estable para conjuntos de datos crecientes.

## Fase 5 — UX y accesibilidad

- Reorganizar navegación alrededor de tareas reales.
- Completar estados vacíos, recovery y flujos de confirmación.
- Auditar teclado, foco, ARIA, contraste y gráficos.

**Salida:** experiencia operativa clara y accesible sin ampliar el alcance de producto.

# Ferova OS — UI Guidelines

> Rediseño integral en curso detrás de `VITE_FEROVA_UI_V2` — ver [DESIGN_SYSTEM_V2.md](./DESIGN_SYSTEM_V2.md) para tokens, sistema de movimiento, 3D y el plan de fases completo. Las reglas de esta página siguen vigentes para el shell actual mientras dure la migración.

## Objetivo

La interfaz debe ayudar a un negocio de servicios a entender qué hacer ahora, ejecutar una operación y verificar el resultado sin sobrecarga visual.

## Navegación actual

El shell ofrece Home, módulos, ajustes, paleta de comandos y asistente IA lateral. Las opciones se filtran por plan y rol. El equipo Ferova dispone además de CRM/Growth.

## Reglas de experiencia

1. Organizar la navegación por tarea: cobrar, registrar gasto, revisar caja, gestionar prospectos, planificar hoy.
2. No mostrar módulos sin acceso; explicar el gating de plan con claridad.
3. Cada vista de datos debe manejar carga, vacío, error, reintento y éxito.
4. Las acciones destructivas o de reemplazo —por ejemplo importación de Sheets— requieren confirmación clara.
5. Mantener métricas con período, moneda y origen visibles.
6. Diferenciar datos registrados, datos importados y contenido generado por IA.
7. Usar la Command Palette para acceso rápido, no como sustituto de una estructura comprensible.

## Formularios y tablas

- Etiquetas visibles y validación próxima al campo.
- Errores accionables, sin filtrar detalles técnicos o secretos.
- Tablas grandes deben ofrecer filtros, orden y, cuando el volumen lo requiera, paginación/virtualización.
- Preservar contexto tras guardar y dar confirmación no intrusiva.

## Accesibilidad

- Navegación completa por teclado y foco visible.
- Menús, tabs y paneles con ARIA correcto (`aria-current`, `aria-expanded`, labels).
- Gráficos con resumen textual equivalente.
- Contraste suficiente y no depender únicamente del color.
- Sustituir progresivamente diálogos nativos por componentes accesibles y consistentes.

## IA

Mostrar que una respuesta es generada, su estado de carga/error y una forma de reintentar. Una sugerencia de IA no debe ejecutarse como modificación material sin confirmación del usuario.

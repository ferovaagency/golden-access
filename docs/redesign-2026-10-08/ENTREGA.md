# Ferova One: entrega del rediseño

> Documento de la primera versión. La revisión vigente azul/blanco y la propuesta basada en componentes reales están en [la entrega del 9 de octubre](../redesign-2026-10-09/ENTREGA.md).

Fecha de cierre: 9 de octubre de 2026. Implementación local, sin publicación.

## Landing implementada

Se conserva el isotipo original entregado por Ferova. La marca de producto se diferencia con el nombre «ferova one», fondo marfil, acciones en vino y acentos dorados. El diseño se limita a la landing; la propuesta de interfaz interna se entrega como prototipo independiente.

La página cuenta con una propuesta de valor directa, demostración interactiva, beneficios por tarea, explicación del asistente, pasos de inicio, planes mensuales/anuales, preguntas frecuentes y cierre de conversión. Los datos de las demostraciones están identificados como ficticios. No se inventaron testimonios, clientes, calificaciones ni cifras de crecimiento.

Los precios y los siete días de prueba proceden del catálogo de planes existente. Cada enlace conserva el plan y período elegidos hasta el acceso. La llamada principal conduce a los planes, para que el usuario conozca condiciones y precio antes de iniciar. Los eventos de CTA, demostración y precios se envían al `dataLayer` existente. Falta conectar un proveedor de analítica para medir conversiones reales.

## Propuesta de interfaz interna

Abrir `propuesta-interfaz.html` en un navegador. Es navegable y no usa datos de una cuenta ni guarda operaciones.

- **Inicio:** tres indicadores, asuntos que necesitan atención y siguientes tareas. Evitar llenar la primera pantalla de todas las métricas disponibles.
- **Clientes:** una ficha con contexto, proyectos y cobros. CRM y oportunidades pueden convivir aquí sin duplicar clientes.
- **Proyectos:** entregables, avance y siguiente paso; acceso al detalle sin perder la posición anterior.
- **Agenda:** tareas, bloques de trabajo y tiempo, con nombres comprensibles.
- **Finanzas:** ingresos, gastos y cobros primero; impuestos, costos y análisis avanzado como opciones progresivas.
- **Asistente:** panel lateral abierto voluntariamente, cerrado por defecto y sin tapar acciones en móvil.
- **Formularios:** cliente, concepto, importe y estado como campos iniciales. Detalles avanzados expandibles; nunca aceptar accidentalmente una venta en cero.
- **Búsqueda:** Ctrl/Cmd+K para saltar a secciones; estado claro cuando no hay coincidencias.

El prototipo incluye los cinco destinos, búsqueda, cambio de período, casillas de tareas, detalles, asistente ilustrativo y validación de una venta de ejemplo. Sus respuestas de IA son textos escritos; no representan una integración nueva.

Orden recomendado para llevarlo a producción: (1) resolver los fallos del informe UX previo —pantallas vacías, permisos, fechas y validación de ventas—; (2) navegación e Inicio; (3) fichas y formularios; (4) medición con usuarios. Las pruebas realizadas aquí son recorridos automatizados y evaluación del diseño, no una investigación con participantes humanos.

## SEO y comprensión por IA

- Dominio canónico corregido a `https://one.ferova.com.co`.
- 33 rutas públicas generadas con contenido HTML, título, descripción, canonical, metadatos sociales y JSON-LD antes de ejecutar JavaScript.
- Mismo árbol React para renderizado estático e hidratación; la aplicación privada no se renderiza en el servidor.
- Sitemap generado desde rutas y artículos; no se inventan fechas de modificación para páginas estáticas.
- `robots.txt` permite contenido público y excluye rutas privadas.
- Organización, aplicación y preguntas frecuentes describen contenido existente. Imagen social propia de 1200 × 630 y logo local.
- Salidas tanto `ruta.html` como `ruta/index.html` para hosts con URL limpia o índices de directorio.

Esto facilita rastreo y comprensión, pero no garantiza posiciones o citas. Google indica que sus funciones de IA usan las bases habituales de SEO y no exigen un archivo especial: [Google Search Central](https://developers.google.com/search/docs/appearance/ai-features). OpenAI distingue el buscador OAI-SearchBot del bot de entrenamiento GPTBot: [documentación de bots](https://developers.openai.com/api/docs/bots).

Después del despliegue hay que verificar que el CDN sirva cada HTML generado, que no bloquee rastreadores, y configurar Search Console. Los códigos 301 para `/landing` y 404 para URL desconocidas requieren reglas del hosting; un archivo estático por sí solo no configura respuestas HTTP. No se modificó el hosting.

## Validación

- Compilación de producción y TypeScript.
- 14 suites existentes: planes, intenciones de registro, cálculos, permisos, importaciones, agenda y demás lógica existente.
- Test nuevo del build: 33 rutas, títulos y descripciones únicos por documento, canonical correcto, JSON-LD válido, enlaces, imágenes y exclusión de aplicación privada.
- Landing a 1440, 768, 375 y 320 px: sin desbordamiento horizontal, errores JavaScript ni violaciones detectadas por axe en reglas WCAG A/AA seleccionadas. Esto no equivale a una certificación de accesibilidad.
- Recorridos: demostración, FAQ, elección de plan anual, menú móvil, contenido sin JavaScript y navegación pública.
- Prototipo: cinco vistas, búsqueda por teclado, importe cero rechazado, simulación sin guardar, apertura/cierre del asistente; revisión axe a 1440, 375 y 320 px.

Evidencias: `visual-qa.json`, `interaction-qa.json` y capturas en esta carpeta. Ejecutar `npm run typecheck`, `npm test`, `npm run build` y `npm run test:marketing`. Las pruebas de navegador usan Playwright con Edge y axe 4.10.3; no se añadieron dependencias de navegador al producto.

## Qué falta para medir el resultado

La implementación está lista para revisión local. No se hizo commit, push ni despliegue. No existe todavía evidencia de aumento de conversiones. Tras publicar, medir visitas → clic en plan → registro → primera acción útil, por dispositivo y origen; usar esos datos y pruebas con usuarios para decidir la siguiente iteración.


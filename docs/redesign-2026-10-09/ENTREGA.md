# Ferova One · Revisión azul y blanco

Entrega del 9 de octubre de 2026. La landing está implementada en el código local. La interfaz privada sigue siendo una propuesta independiente, sin cambios aplicados al producto ni publicación.

## Vistas

- Landing de producción local: http://127.0.0.1:4173/
- Propuesta con componentes reales: http://127.0.0.1:4175/
- Capturas: `landing-hero.png`, `interfaz-hero.png`, `interfaz-clientes.png`, `interfaz-proyectos.png`, `interfaz-ventas.png` y vistas móviles.

La propuesta anterior de cinco áreas era conceptual. Esta versión la sustituye: conserva la estructura real Inicio / Proyectos / Finanzas / Ventas / Configuración y sus identificadores internos.

## Landing implementada

Se mantiene la estructura aprobada, los textos, la demostración, las preguntas frecuentes y los enlaces a planes. La línea gráfica ahora usa azul `#2563eb`, azul profundo `#123a85`, blanco y tintes azules. El isotipo conserva la geometría original; se presenta en blanco sobre azul y en azul cuando necesita contrastar sobre blanco. También se actualizaron favicon, imagen social y color del navegador.

Los estilos de la landing se limitan a sus componentes. Se conservan los 33 HTML públicos, metadatos, sitemap, datos estructurados, navegación, selección de plan y eventos de conversión de la implementación previa. No hay cambios de precios, cobro, autenticación ni suscripción.

## Lo que encontré en la construcción actual

| Parte | Cómo funciona ahora | Consecuencia para un rediseño |
|---|---|---|
| `src/App.tsx` | Coordina usuario, cuenta activa, datos, período, pestaña y guardados. Persiste la pestaña en sessionStorage. | No sustituir la aplicación por una maqueta ni cambiar los IDs de pestañas. |
| `src/components/layout/AppShell.tsx` | Recibe secciones y callbacks; contiene navegación principal, subnavegación, encabezados y espacio para el asistente. | Es el lugar para mejorar presentación sin reescribir módulos. |
| `PrimaryNavigation` / `ContextNavigation` | Separan secciones y destinos, con grupos en Finanzas. | Mantener el inventario completo; no ocultar IVA, Horas, Costos o Seguimiento. |
| Permisos y planes | `App.tsx` filtra por `canView`; capacidades dependen de módulos/plan. `financeService` aplica límites y usa la cuenta activa. | Conservar filtros y callbacks; una propuesta de estilo no debe reemplazar estas decisiones. |
| Cálculos | `calcularMétricasFinancieras`, motor financiero y servicios compartidos. | Reutilizar resultados actuales; no crear métricas nuevas con fórmulas alternativas. |
| Proyectos | Se construyen desde clientes, servicios, ventas y horas; objetivos, KPIs y entregables viven asociados al cliente. | Mantener esa relación, no inventar un nuevo modelo de proyectos al cambiar la pantalla. |
| Guardados | Los módulos reciben `onSave…`; `App.tsx` delega en `financeService`. Hay sincronizaciones e integraciones específicas. | Conservar sus contratos y los efectos de cada operación. |
| Preferencias | Orden del inicio, ancho/estado del asistente y borradores tienen persistencia propia. | No borrarlas como efecto de un cambio visual. |
| Flag de interfaz | `isFerovaUiV2Enabled()` devuelve verdadero salvo que `VITE_FEROVA_UI_V2` sea exactamente `false`. Algunos comentarios todavía dicen que está apagado por defecto. | Guiarse por el código ejecutable. No cambié el flag ni su valor. |

Revisé también la distinción entre `handleNavigate` y `navigateTo`: no hacen exactamente las mismas comprobaciones. Antes de integrar una futura revisión del contenedor, hay que probar destinos bloqueados por plan y colaboradores. Esta propuesta no cambia esas rutas ni pretende corregir ese comportamiento.

## Propuesta fiel a los componentes actuales

La vista de comparación importa el **AppShell existente y diez componentes reales**, en lugar de reconstruir versiones simplificadas:

| Destino conservado | Componente reutilizado |
|---|---|
| Resumen | `Home` |
| Clientes | `ClientesAdmin` |
| Servicios | `ServiciosAdmin` |
| Horas | `HorasAdmin` |
| Proyectos | `ProyectosAdmin` |
| Ingresos | `VentasAdmin` |
| Equilibrio | `EquilibrioGlobal` |
| Por servicio | `EquilibrioServicio` |
| IVA | `ImpuestosIva` |
| Alertas | `AlertasTributarias` |

El comparador **Aspecto actual / Propuesta azul-blanco** cambia únicamente el CSS de estas vistas: conserva sus nodos, campos, controles y cálculos. El encabezado de revisión, el selector de período, TRM de ejemplo, búsqueda y panel ilustrativo de IA pertenecen al entorno de propuesta; no son una reproducción completa de la sesión de producción.

La propuesta mejora legibilidad y contraste, usa superficies blancas, reserva el azul para orientación y acciones, aclara la selección del menú y mantiene las herramientas avanzadas disponibles. Los colores semánticos de alertas y los colores categóricos de gráficos existentes se conservan para no alterar su significado.

En Ingresos **no se redujo el formulario a tres campos**: se conservan fecha, cliente, servicio, cantidad, precio, moneda, costos, adelanto, pasarela, comisiones, TRM, IVA, retención, notas y demás controles que muestra el componente actual. Lo mismo aplica a los formularios de los otros módulos.

Las otras 14 entradas del menú permanecen representadas, pero sus pantallas conectadas **no están simuladas**. Al abrirlas se indica esa limitación. Holding y administración son condicionales y no aparecen en esta cuenta ficticia, que representa a un propietario Full sin holding. No se hizo una prueba de permisos con una cuenta real en esta revisión.

## Aislamiento

La propuesta se construye con `vite.preview.config.ts` y sale a `.interface-preview/`, separada de `dist/`. Usa datos ficticios y callbacks que actualizan solamente memoria de esa pestaña. Los borradores que ya mantienen los componentes pueden persistir en el almacenamiento local del origen de la propuesta.

Cuatro servicios de lectura se sustituyen por adaptadores offline; no se importan servicios de Supabase. El build falla si intenta importar `lib/supabase`, y la página incluye `connect-src 'none'`. La prueba de navegador verificó cero peticiones externas. El asistente muestra texto ilustrativo, no una respuesta de IA.

No se modificaron `src/App.tsx`, los componentes privados, los hooks, el flag de interfaz, los servicios de datos ni las fórmulas. La propuesta no se incorpora a las rutas del producto.

## Pruebas y evidencia

- TypeScript, build de producción y las 14 suites existentes: correctos.
- Build de marketing: 33 rutas públicas, enlaces, metadatos y JSON-LD correctos.
- Landing a 1440, 768, 375 y 320 px: sin desbordamiento horizontal, errores JS ni violaciones detectadas por axe en las reglas WCAG A/AA seleccionadas.
- Landing: menú, cierre por Escape, planes anuales, demostración, FAQ y contenido sin JavaScript verificados.
- Diez componentes: igualdad de texto, controles, valores y opciones antes/después de cambiar apariencia.
- Propuesta: búsqueda por teclado, menú móvil, asistente y geometría a cuatro anchos; cero errores de página y cero peticiones externas.
- Se conserva `qa-landing.json` y `qa-interfaz.json` con los resultados. La evaluación automática no es una certificación ni sustituye pruebas con usuarios.

## Reproducir

```powershell
npm run build
npm run test:marketing
npm run preview -- --host 127.0.0.1 --port 4173
```

En otra terminal, para la propuesta independiente:

```powershell
npx vite build --config docs/redesign-2026-10-09/vite.preview.config.ts
Copy-Item .interface-preview/docs/redesign-2026-10-09/interfaz-real.html .interface-preview/index.html
npx vite preview --config docs/redesign-2026-10-09/vite.preview.config.ts
```

Los scripts `qa-landing.cjs` y `qa-interfaz.cjs` requieren Playwright con Edge. Admiten `PLAYWRIGHT_MODULE` si se usa un runtime externo, y el archivo de axe 4.10.3 en la carpeta temporal como `ferova-axe.min.js`.

## Alcance para aplicar después

Una futura integración de la propuesta debe empezar por los estilos y el contenedor, conservar los módulos, y comprobar registro/edición/abonos, filtros por período, TRM, importación/exportación, permisos, cambios de workspace, integración con Planner y retorno desde autenticación. No se ha realizado esa integración aquí. La landing sí está implementada; no se hizo push ni despliegue.

# Informe de experiencia de usuario — Ferova One

**Fecha:** 8 de octubre de 2026, hora de Bogotá.  
**Plataforma probada:** https://one.ferova.com.co/app  
**Método:** recorrido de usuario ejecutado con navegador real automatizado, inspección visual, pruebas de teclado, axe-core 4.10.3 y contraste con el código local. No es un estudio con participantes humanos ni una certificación de accesibilidad.  
**Código de referencia:** repositorio golden-access, revisión local `3db5d02`. No se verificó que el despliegue corresponda exactamente a ese commit.

## Dictamen

**La plataforma tiene una base funcional útil, pero todavía presenta fricciones importantes para trabajar con confianza y continuidad.** Las áreas financieras y de planificación se pueden recorrer; el acceso por enlace mágico funciona; la separación en cinco áreas facilita orientarse. Sin embargo, hay destinos vacíos, comportamiento inconsistente de los candados, una fecha predeterminada incorrecta para Colombia, guardado accidental de ventas de cero y una interferencia del asistente en pantallas estrechas.

Mi recomendación es corregir primero los cinco hallazgos de prioridad alta. Después, simplificar formularios y mensajes, y resolver accesibilidad y estabilidad visual. No hace falta rediseñar toda la plataforma para lograr una mejora apreciable.

| Dimensión | Evaluación basada en esta prueba |
|---|---|
| Encontrar funciones | Estructura general comprensible; búsqueda y destinos bloqueados interrumpen el recorrido. |
| Aprender a usarla | Exige entender demasiados conceptos, formularios y mensajes desde el principio. |
| Trabajo diario | Hay herramientas útiles, pero validaciones y fechas necesitan mayor protección. |
| Fluidez | Carga inicial razonable en este equipo; cambios de posición perceptibles al cargar el panel. |
| Móvil | Navegación directa y vistas del Planner utilizables; transición desde escritorio con asistente abierto falla. |
| Accesibilidad | Problemas confirmados de contraste, nombres de controles y etiquetas. |
| Confianza | La combinación de vocabulario heredado, candados inconsistentes y fechas resta claridad. |

No asigno una nota numérica global: una sola cuenta y recorridos sin transacciones completas no permiten una puntuación representativa de todo el producto.

## Cobertura y límites

Se realizaron **30 comprobaciones de rutas públicas**: 15 rutas a 1440 y 375 px. Se recorrieron **21 destinos del área privada**, las **8 vistas de Finanzas operativas** y las **5 vistas del Planner**. Se hicieron comprobaciones adicionales de acceso, selección de plan anual, validación del correo vacío, FAQ, búsqueda por teclado, recarga, menú móvil y tablet a 768 px.

La cuenta proporcionada muestra una prueba de 7 días y candados en CRM, Marketing ROI y Reportes CEO. Por ello, **no está validada la operación completa de planes superiores**, ni los permisos de colaboradores o administradores.

| Área | Qué se comprobó | Qué queda pendiente |
|---|---|---|
| Sitio público | Inicio, precios, funciones y cuatro subpáginas, blog, acceso, privacidad, términos, reembolsos, seguridad, novedades y ruta inexistente. | Lectura de todos los artículos, enlaces externos y todas las variantes de contenido. |
| Acceso | Envío y recepción del enlace mágico, entrada a la cuenta, conservación de plan anual desde precios, correo obligatorio. | Google, Microsoft, recuperación de contraseña, expiración del enlace y cierre/reingreso. |
| Inicio | Panel, cifras, prioridades, estados sin datos, búsqueda y acciones visibles. | Grandes volúmenes de datos y comportamiento de todos los indicadores con actividad real. |
| Proyectos | Clientes, servicios, horas, proyectos y formularios disponibles. | Ciclo completo de crear, editar y cerrar proyectos con múltiples clientes. |
| Planner | Día, Lista, Kanban, Semana y Calendario; navegación móvil y tablet. | Crear tareas, cronómetro, reprogramación y sincronización real con Calendar/Notion. |
| Finanzas | Ingresos, pagos, costos, equilibrio, IVA, alertas, seguimiento y ocho vistas operativas. | Validación contable, importaciones, conciliación, pagos y exportaciones completas. |
| Ventas y reportes | Destinos con candado y respuesta de la interfaz. | CRM con acceso habilitado, campañas persistidas y generación de reportes. |
| Configuración | Integraciones, configuración y Memoria: lectura y formularios. | Conexiones externas, cambios de permisos, creación de organizaciones y persistencia de Memoria. |
| Asistente | Apertura, disposición y efecto sobre navegación. | Calidad de respuestas, consumo, acciones y exactitud sobre datos del negocio. |

No se realizaron compras, cambios de suscripción, envíos a clientes ni conexiones externas. La prueba del formulario sin importe **sí creó inesperadamente una venta de cero**; se eliminó exclusivamente ese registro y se comprobó después de recargar que el historial volvió a estar vacío. El tutorial se omitió para continuar el recorrido. No se modificó código de la aplicación ni se desplegaron cambios.

## Hallazgos prioritarios

### UX-01 · Alta · La búsqueda “Ir a Home” abre una pantalla vacía

**Reproducción:** abrir `/app` → Ctrl+K → escribir `Home` → Enter.

**Observado:** permanece el marco de navegación y el asistente, pero desaparece el contenido del resumen. Se reprodujo con la sesión autenticada. La búsqueda de Clientes sí abrió el módulo y la recarga conservó ese destino.

**Impacto:** un atajo principal conduce a un callejón sin salida; el usuario no sabe si perdió datos o si la aplicación falló.

**Corrección:** mapear Inicio al destino real del resumen y añadir una pantalla de recuperación para cualquier identificador desconocido. En el código local, `CommandPalette.tsx` usa `go('home')`, mientras el resumen se renderiza para `dashboard`.

**Aceptación:** Inicio desde búsqueda, menú y notificaciones abre el mismo resumen y nunca deja el área central vacía.

**Evidencia:** [captura](verify-command-home.png), `focused.json`, caso `verify-command-home`.

### UX-02 · Alta · Los candados no tienen una respuesta consistente

**Reproducción:** Ventas → CRM; después Marketing ROI. Comparar con Finanzas → Reportes CEO.

**Observado:** CRM con candado deja el contenido vacío incluso tras esperar. Marketing ROI con candado sí muestra formulario de campaña y calculadora. Reportes CEO con candado muestra controles para generar reportes. No se ejecutaron campañas ni generación.

**Impacto:** no queda claro qué incluye la prueba, qué está restringido ni cómo continuar.

**Corrección:** todas las entradas deben pasar por la misma comprobación de acceso. Mostrar beneficio, plan requerido y acción clara para continuar o volver.

**Aceptación:** menú, búsqueda, accesos rápidos y enlaces directos producen el mismo resultado para un mismo permiso. La visualización de controles no demuestra por sí sola un fallo de autorización del backend; eso requiere otra prueba.

**Evidencia:** [CRM vacío](verify-locked-crm.png), [Marketing ROI](verify-locked-marketing.png), `focused.json` y `authenticated.json`.

### UX-03 · Alta · La fecha de ventas puede adelantarse al día siguiente

**Observado:** en una sesión configurada con `America/Bogota`, el Planner usa **2026-10-08**, pero el formulario de ingresos muestra **2026-10-09**. La venta accidental también quedó con día 9.

**Causa respaldada por el código:** Ventas, Horas y Pagos inicializan fechas usando `toISOString()`, que construye la fecha UTC. El valor del formulario de ventas también puede persistirse como borrador. Horas y Pagos se señalan como riesgo por código; no se repitió allí el experimento completo.

**Impacto:** un registro realizado de noche puede caer en otro día o período y obligar al usuario a corregirlo.

**Corrección:** construir fechas civiles con la zona del negocio y revisar borradores que conserven fechas antiguas.

**Aceptación:** probar antes y después de medianoche UTC, incluyendo fin de mes; la fecha predeterminada debe coincidir con Bogotá cuando esa sea la zona del negocio.

**Evidencia:** `mobile.json`, caso `date-bogota`; [captura](date-bogota.png); `VentasAdmin.tsx:47`, `HorasAdmin.tsx:42`, `PagosEgresosAdmin.tsx:40` en el código local.

### UX-04 · Alta · Se puede guardar una venta de $0 sin introducir datos

**Reproducción observada:** con un cliente y un servicio ya existentes, abrir Ingresos y pulsar Registrar Venta sin introducir importe.

**Resultado:** se crea una venta de $0, marcada Pagado, con el cliente y servicio preseleccionados. Se eliminó el registro creado por esta prueba y se verificó el resultado tras recargar.

**Impacto:** un clic accidental altera el historial y puede modificar indicadores asociados a costos o actividad, aunque no existan ingresos.

**Corrección:** exigir importe válido, o una intención explícita y claramente identificada para operaciones gratuitas. Resaltar junto al campo el motivo que impide guardar.

**Aceptación:** el formulario inicial no crea registros involuntarios. Si el negocio admite servicios gratuitos, debe distinguirlos de una venta ordinaria.

**Evidencia:** `subflows.json`, casos `empty-sale-validation` y `empty-sale-form`; `cleanup.txt` confirma la eliminación.

### UX-05 · Alta · El asistente tapa el menú al reducir el ancho

**Reproducción:** abrir el panel a 1440 px con asistente expandido → reducir a 375 px → intentar Abrir menú.

**Observado:** el panel de IA se superpone al contenido y a la zona del menú. El navegador detectó que el asistente interceptaba el clic durante los reintentos. La carga directa a 375 px sí permitió abrir el menú y navegar.

**Impacto:** afecta a ventanas estrechas, cambios de orientación y usuarios que alternan tamaños.

**Corrección:** cerrar o convertir el asistente en un panel móvil explícito al cambiar de breakpoint, mantener un cierre accesible y controlar foco y superposición.

**Aceptación:** menú y cierre siempre alcanzables a 375 y 768 px, también después de redimensionar con IA abierta.

**Evidencia:** [superposición](mobile-home.png), [menú en carga directa](mobile-drawer.png).

## Hallazgos de mejora

### UX-06 · Media · Contraste y controles accesibles

Axe detectó contraste insuficiente en **10 de las 15 rutas públicas**, tanto en escritorio como en móvil. En precios, el botón naranja con texto blanco obtuvo **2,13:1**; textos secundarios del acceso, **2,63:1**. Son valores reportados por la herramienta, inferiores al mínimo que aplica en esas comprobaciones.

En Clientes se detectaron casillas y selector sin nombre accesible; en Planner, campos sin etiqueta; en Ingresos, campos/selectores sin nombre y una región desplazable no accesible mediante foco. En móvil apareció un botón sin nombre.

**Acción:** asociar `label` e `id`, nombrar botones de icono, corregir tokens de contraste y probar navegación completa con teclado y lector de pantalla. La severidad técnica de axe para algunos controles es `critical`; esta prioridad de producto no elimina su impacto para personas que usan tecnología asistiva.

**Evidencia:** `public.json`, `focused.json`; [Clientes](a11y-clientes.png), [Ingresos](a11y-ingresos.png).

### UX-07 · Media · El panel cambia de posición durante la carga

Tres mediciones de laboratorio registraron CLS aproximado de **0,167** en `/app`, mientras la landing quedó entre **0,00023 y 0,00114**. La medición del panel corresponde al estado disponible de la cuenta durante la auditoría y a una ventana de observación corta.

**Acción:** reservar altura para el encabezado, aviso de prueba, datos y módulos; evitar insertar banners después de mostrar contenido. Revisar con una traza antes de atribuir la causa a un componente específico.

### UX-08 · Media · El formulario de ingresos muestra demasiadas decisiones a la vez

Antes de registrar una venta aparecen cliente, servicio, cantidad, precio, costos, varias líneas, pasarela, comisión porcentual y fija, retiro, abono, impuestos y notas. Con el asistente abierto, el espacio útil se reduce aún más.

**Acción:** primer nivel con fecha, cliente, servicio, importe y estado del cobro; agrupar impuestos, comisiones y múltiples ítems en secciones desplegables. Mostrar al final un resumen legible del total y neto.

**Aceptación propuesta:** una persona nueva registra una venta sencilla sin tener que interpretar opciones que no aplican. Esta mejora requiere validación posterior con personas; no se midió tiempo humano de tarea.

### UX-09 · Media · Las instrucciones no siempre coinciden con el menú

Ejemplos observados:

- Ingresos manda a **“Projects → Seguimiento”**, pero Seguimiento está en Finanzas.
- Planner pide **“Reorganizar mi día”**, mientras el botón visible dice **“Organizar agenda automáticamente”**.
- El estado vacío de ventas habla de una “base de datos de Sheets”.
- Ingresos menciona clientes de “Ferova Agency” dentro de un producto destinado también a otros negocios.
- Inicio mezcla “Business Health”, “Executive Brief”, “Recent Activity” y “Quick Actions” con español.

**Acción:** unificar nombres, idioma y mensajes desde la interfaz real. Usar enlaces accionables a la configuración correspondiente.

### UX-10 · Media · Inicio repite prioridades y exige mucho desplazamiento

Con la cuenta sin ventas ni horas aparecen dos avisos para ventas y dos para horas. También hay gráficos vacíos, varios mensajes informativos y acciones rápidas al final de una página larga. La captura de escritorio mide aproximadamente **2644 px de alto**.

**Acción:** agrupar avisos por tarea, mostrar las tres siguientes acciones y convertir los gráficos vacíos en una guía de primer uso. Mantener una explicación breve de utilidad real, proyectada y neta: sus diferencias pueden ser correctas, pero no resultan evidentes para alguien nuevo.

**Evidencia:** [Inicio completo](desktop-inicio.png).

### UX-11 · Media · Correo de acceso con otra marca y otro idioma

El enlace llegó y funcionó, pero el remitente visible fue **Golden-Access** y el asunto **“Sign in to your account”**. El producto se presenta como Ferova One y la interfaz está en español.

**Acción:** personalizar nombre, asunto y cuerpo del mensaje; indicar caducidad y qué hacer si no llega. Mantener la misma marca durante todo el acceso.

No se incluyeron enlaces de autenticación ni tokens en el reporte.

### UX-12 · Media · La navegación interna no tiene direcciones por módulo

Los destinos recorridos conservan `/app`; el código guarda la pestaña en `sessionStorage`. La recarga conservó Clientes, lo cual es positivo, pero la URL no identifica ese destino.

**Impacto:** dificulta compartir instrucciones, abrir un módulo en otra pestaña y razonar sobre Atrás/Adelante. El botón Atrás no fue sometido a un recorrido completo; ese efecto es un riesgo respaldado por la estructura, no un resultado probado.

**Acción:** introducir rutas o parámetros estables, conservando compatibilidad con el estado actual.

### UX-13 · Media · Las URL canónicas apuntan a otro dominio

El sitio funciona en `one.ferova.com.co`, pero las páginas inspeccionadas publican canónicas en `ferova.one`. Este último no resolvió desde el equipo de prueba. El propio repositorio lo describe como un dominio provisional.

**Acción:** confirmar el dominio definitivo y alinear canónicas, sitemap y enlaces de compartir. El fallo DNS observado no demuestra por sí solo indisponibilidad mundial.

**Evidencia:** `public.json`, propiedad `canonical`; `src/seo/config.ts` y `docs/SEO_LANDING_BLOG.md`.

## Lo que funciona y conviene conservar

- El enlace mágico llegó y permitió entrar a la cuenta de prueba.
- Cambiar a anual en Precios conservó el plan y período al llegar al acceso.
- El correo vacío se detuvo mediante validación nativa.
- La FAQ de prueba gratis se expandió y explicó las condiciones.
- Cinco áreas principales ofrecen una base razonable para orientarse.
- Las ocho vistas financieras operativas y cinco vistas del Planner pudieron abrirse.
- El menú móvil funcionó en carga directa; Planner cambió entre vistas en móvil y tablet.
- No hubo desbordamiento horizontal del documento en las 30 comprobaciones públicas ni en las capturas móviles registradas. Esto no implica que toda tabla interna resulte cómoda.
- La búsqueda de Clientes y la conservación del módulo al recargar funcionaron.
- Las 30 comprobaciones públicas no registraron errores JavaScript, HTTP 4xx/5xx ni imágenes rotas. La ruta inexistente mostró su pantalla de recuperación, aunque respondió HTTP 200.

## Fluidez medida

Navegador Edge automatizado, escritorio de 1440 px, sin limitar CPU o red. Tres contextos nuevos; cachés de red/sistema no controladas. LCP y CLS observados durante una ventana corta después de la carga. **Son mediciones de laboratorio, no datos de usuarios reales, percentiles de producción ni una certificación Core Web Vitals.**

| Métrica | Landing | Panel autenticado |
|---|---:|---:|
| LCP, tres muestras | 1,156–1,652 s | 1,660–1,960 s |
| Mediana de LCP | 1,556 s | 1,836 s |
| CLS | 0,00023–0,00114 | 0,167 en las tres muestras |
| TTFB | 124–139 ms | 115–176 ms |

Las 30 navegaciones públicas llegaron a inactividad de red en **1,19–2,86 s**. Esa duración incluye esperas del navegador y **no equivale a LCP ni a tiempo de respuesta de cada clic**. No se midió INP de manera representativa.

**Interpretación:** en este entorno el mayor problema de fluidez es la interrupción del recorrido y el movimiento de la interfaz, más que una carga inicial sistemáticamente lenta. Falta comprobar redes lentas y cuentas con muchos registros.

## Orden de trabajo recomendado

1. **Confiabilidad:** resolver búsqueda/Home, candados, fechas locales y guardado accidental de cero. Volver a ejecutar sus casos de reproducción.
2. **Móvil y acceso:** corregir asistente al redimensionar, etiquetas, botones y contraste; probar teclado y lector de pantalla.
3. **Facilidad de uso:** simplificar Ingresos, agrupar prioridades, corregir instrucciones y personalizar el correo.
4. **Fluidez y navegación:** reducir cambios de posición y dar una dirección estable a cada módulo.
5. **Validación ampliada:** entorno de pruebas con planes Básico, Intermedio y Full, roles de colaborador, integraciones de prueba y datos abundantes. Ejecutar venta → abono → conciliación, tarea → tiempo → horas y proyecto → KPI → reporte. Después, observar usuarios nuevos realizar esas tareas sin ayuda.

## Evidencias y reproducibilidad

- `authenticated.json`: lectura de los 21 destinos privados. Algunas capturas iniciales coinciden con transiciones; los casos dudosos se verificaron en `focused.json`.
- `public.json`: 30 comprobaciones públicas con respuestas, geometría, enlaces y axe.
- `focused.json`: reproducción de pantallas vacías, candados y accesibilidad.
- `subflows.json`: vistas financieras, Planner, teclado, recarga y venta de prueba.
- `journeys.json`: plan anual, acceso, validación del correo, FAQ y menú móvil.
- `mobile.json`: vistas móviles/tablet y comparación de fechas.
- `performance.json`: seis mediciones de carga.
- `cleanup.txt`: verificación de eliminación de la venta accidental.
- Capturas PNG en esta misma carpeta. El identificador de la cuenta está oculto en las capturas privadas.

**Hallazgo descartado:** Seguimiento inicialmente pareció conservar Alertas. Al esperar la carga se mostró su contenido correcto; no se incluye como defecto. Tampoco se declara una regresión visual: no existe una captura base validada con la que comparar.

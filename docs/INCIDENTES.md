# Manejo de incidentes y soporte

Definido **antes** de la primera caída, no durante. En un incidente grave, el
silencio enfada más que la caída: comunica aunque sea para decir que sigues
investigando.

## Canal y horario de soporte

- **Canal:** gerencia@seoparaecommerce.co (asunto claro).
- **Horario publicado:** lunes a viernes, 9:00–18:00 (hora Colombia).
- **Compromiso de primera respuesta:** 1 día hábil.

Regla: promete de menos y cumple de más. Si prometes 1 día hábil y respondes en
3 horas, quedas bien; si prometes "en minutos" y tardas 6 horas, quedas mal con
el mismo esfuerzo.

## Severidades

| Nivel | Definición | Ejemplo | Cadencia de actualización |
|---|---|---|---|
| **SEV-1** | Caída total o riesgo de datos (posible fuga entre cuentas, pérdida de datos). | La app no carga; login roto; datos de un cliente visibles para otro. | Cada 30 min hasta resolver. |
| **SEV-2** | Función principal caída sin workaround. | No se pueden registrar ventas/gastos; el asistente no responde. | Cada 60 min. |
| **SEV-3** | Degradación o función secundaria con workaround. | Un reporte tarda; una integración falla puntualmente. | Diaria. |
| **SEV-4** | Cosmético o menor. | Un texto desalineado; un ícono. | En el changelog. |

Un incidente de **fuga de datos entre cuentas es siempre SEV-1** y, además,
reportable: 72 horas a la autoridad de la UE si aplica y 15 días hábiles a la SIC
en Colombia.

## Durante el incidente

1. Reconoce: abre el caso, asigna severidad, registra la hora de inicio.
2. Comunica según la cadencia de la tabla, aunque sea "seguimos investigando".
3. Mitiga primero (restaurar servicio), diagnostica después.
4. Cierra: confirma resolución y hora de fin.

## Plantilla de postmortem (para SEV-1 y SEV-2)

```
# Postmortem — <título corto>
- Fecha / duración: <inicio> → <fin> (<minutos> min)
- Severidad: SEV-<n>
- Impacto: <qué no funcionó, a cuántos afectó, hubo pérdida/fuga de datos>

## Línea de tiempo
- HH:MM  <qué pasó / qué se hizo>

## Causa raíz
<qué falló de verdad, no el síntoma>

## Cómo se detectó
<alerta / reporte de cliente / manual>

## Acciones correctivas
- [ ] <cambio para que no vuelva a pasar> — responsable — fecha

## Qué salió bien / qué mejorar en la respuesta
```

Sin culpas a personas: el postmortem busca el fallo del sistema, no un culpable.

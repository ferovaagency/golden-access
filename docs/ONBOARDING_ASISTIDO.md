# Onboarding asistido — guía de la llamada (primeros ~20 clientes)

Con los primeros clientes, tú configuras CON ellos en una llamada de 30 min. No
es un costo de soporte: es tu mejor investigación de producto y donde descubres
qué módulos sobran. El objetivo de la llamada es UNO: que el cliente llegue a su
**momento de valor** — ver la verdad de su negocio en números y/o pedirle algo
al asistente y que responda con SUS datos.

> Momento de valor (lo que medimos): `activation` con `milestone` =
> `primera_venta` (registró su primera venta real) o `primer_uso_asistente`
> (primera consulta al asistente). Ver `src/lib/analytics.ts`.

## Antes de la llamada (2 min, tú)
- Confirma que su cuenta quedó activa (trial o pago) — panel admin → Suscripciones.
- Ten a mano su industria/tipo de negocio si ya lo sabes.

## Guion de 30 minutos

**0–3 min · Encibrar el para qué.** "En 30 minutos vas a ver tus números reales y
a hacerle una pregunta a tu asistente. Lo configuramos juntos." Pregunta cuál es
su dolor #1 hoy (caja, cobros, saber si gana). Eso guía qué priorizar.

**3–10 min · Identidad + primer cliente/servicio (paso de onboarding in-app).**
- Que complete "Cuéntanos lo esencial" (nombre, industria, tipo, equipo).
- Cree su **primer cliente** y su **primer servicio con costo**. Aquí ya empieza a
  ver estructura.

**10–20 min · La verdad en números (el momento de valor #1).**
- Que registre **2–3 ventas reales** recientes y **1–2 gastos/pagos reales**.
- Abran el **Resumen CEO / Finanzas**: ahora ve utilidad real, margen y caja con
  SUS cifras. Este es el "ajá". No sigas hasta que lo vea.
- Si aplica, registra **horas** de un servicio para que vea rentabilidad por cliente.

**20–26 min · El asistente con sus datos (momento de valor #2).**
- Que le pregunte algo real: "¿en qué servicio estoy perdiendo plata?", "¿cuánto
  llevo en ventas este mes?". Que vea que responde con SUS números, no genéricos.
- Muéstrale que puede pedirle **crear una tarea** o **registrar un gasto** por chat.

**26–30 min · Cerrar el loop.**
- Deja UNA tarea concreta en el Planner (su siguiente acción real).
- Explica soporte: correo, 1 día hábil (ver /seguridad).
- Si está en trial: recuérdale la fecha de cobro y que puede cancelar sin costo.
- Pídele **una cosa**: qué le sobró y qué le faltó. Anótalo (es oro de producto).

## Después de la llamada (tú)
- Registra en `crm_oportunidades`/CRM el estado y el siguiente contacto.
- Anota el feedback. A los 3–4 días, revisa en el panel admin si volvió a entrar
  (engagement) y si registró más datos; si no, escríbele con una razón concreta
  para volver.

## Señales de que el onboarding funcionó
- El evento `activation` se disparó para ese usuario.
- Registró datos reales (ventas/gastos), no solo de ejemplo.
- Usó el asistente al menos una vez.
- Tiene al menos una tarea activa en el Planner.

## Qué NO hacer
- No lo abrumes con todos los módulos. Prioriza su dolor #1 y el momento de valor.
- No dejes la llamada sin que haya visto sus números reales.

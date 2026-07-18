# Ferova OS — Business OS Bible

> Fuente de verdad funcional. Describe capacidades existentes, no funcionalidades futuras.

## Producto

Ferova OS es una aplicación operativa para agencias y negocios de servicios: finanzas, clientes, servicios, proyectos, horas, CRM, planeación, inteligencia de negocio, reportes CEO y asistentes de IA. No implementa inventario, nómina, libro mayor contable ni presentación tributaria.

## Usuarios y acceso

| Usuario | Acceso |
|---|---|
| Visitante | Autenticación |
| Registrado sin acceso | Paywall |
| Suscripción o cortesía activa | Módulos de su plan |
| Equipo Ferova | Módulos de cliente y CRM interno/Growth |

El acceso combina `user_subscriptions`, `courtesy_access_grants` y `crm_team_members`. Los planes actuales habilitan Financiero y CRM y Ventas.

## Capacidades existentes

- **Finanzas:** clientes, servicios, herramientas, gastos, pagos/egresos, ventas, abonos, horas, dashboard, equilibrio, IVA y alertas tributarias.
- **Operación:** proyectos, capacidad/horas y rentabilidad por servicio.
- **CRM de cliente:** contactos y CRM/Ventas según plan.
- **CRM interno:** oportunidades, interacciones, citas, contenido potencial, bot, WhatsApp y reseñas.
- **Planner y BI:** inbox, tareas, bloques, rutinas, metas, insights, briefings, health snapshots y blind spots.
- **Dirección:** reportes CEO y simulaciones de decisión.
- **Integraciones:** Google Sheets/Drive/Calendar/Gmail, PayPal, WhatsApp, Apollo, LinkedIn, Reddit y TRM.

## Flujo principal

```text
Autenticación → acceso/plan → carga de perfil y datos financieros
→ onboarding si aplica → módulo → Supabase → IA/integración opcional
```

## Principios

1. Supabase es la fuente primaria; Google Sheets es importación/respaldo opcional.
2. Plan y rol determinan la experiencia disponible.
3. La IA asiste; el usuario mantiene control operativo.
4. El CRM interno y el CRM del cliente son dominios distintos.
5. La operación conecta ingresos, costos, capacidad, relaciones y decisiones.

## Referencias

`src/App.tsx`, `src/lib/planService.ts`, `src/lib/calculations.ts`, `src/lib/financeService.ts`, `src/lib/crmService.ts`, `src/lib/plannerService.ts`, `supabase/migrations/`.

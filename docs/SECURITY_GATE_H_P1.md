# Gate de seguridad H-P1 — aislamiento por tenant

Estado al 2026-07-23: **NO VERIFICADO EN PRODUCCIÓN — BLOQUEA tráfico público con datos de usuarios.**

## Evidencia encontrada

- El navegador publicado usa el proyecto Lovable Cloud `izkhdzzyqfopjveaagwk`.
- `supabase/config.toml` apuntaba a `rrjyfyihdnbvbtdxygyp`; se corrigió para evitar que una migración o función termine en el proyecto externo equivocado.
- Las migraciones de Finanzas, Planner, BI, auditoría y perfiles habilitan RLS y limitan filas con `auth.uid() = user_id`.
- Algunas tablas históricas `crm_*` son deliberadamente compartidas entre miembros del equipo mediante `is_team_member()`. No deben reutilizarse como almacenamiento multi-tenant de clientes.
- El proyecto Lovable `izkh…` no aparece en la cuenta Supabase conectada a Codex, por lo que todavía no fue posible consultar `pg_policies`, `relrowsecurity` y los Security Advisors del backend exacto de producción.

## Condición para pasar a SÍ

1. Consultar en `izkh…` todas las tablas expuestas y confirmar RLS activo.
2. Confirmar que cada tabla de cliente tiene políticas `USING` y `WITH CHECK` ligadas a `auth.uid()`.
3. Confirmar que las vistas públicas usan `security_invoker` o no están concedidas a `anon/authenticated`.
4. Ejecutar Security y Performance Advisors sin hallazgos críticos de acceso.
5. Probar con dos usuarios reales que A no puede leer, modificar ni borrar filas de B.

Hasta completar esas cinco pruebas no se publicará un feed de “personas registradas” ni ningún agregado público basado en datos privados. El contador Founder Access comunica únicamente el límite real de la cohorte (20 cupos), no un número inventado de ventas.

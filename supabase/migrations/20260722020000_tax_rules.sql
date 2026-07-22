-- tax_rules: reglas tributarias versionadas por país/jurisdicción/año
-- (Manual maestro, secciones 4.10 y 17 -- Apéndice A.3). Reemplaza el
-- supuesto anterior de "Config es un singleton plano, siempre usa los
-- valores de hoy" con una fuente versionada y auditable, sin romper nada:
-- se siembra con los MISMOS valores que ya eran el default de
-- finance_config, así que hasta que algo empiece a leerla activamente el
-- comportamiento no cambia para nadie.
--
-- Es dato de referencia compartido (la ley tributaria es la misma para
-- todos los usuarios de un país), no por-usuario como finance_config --
-- por eso no tiene user_id ni RLS por owner.
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  jurisdiction text,
  taxpayer_type text NOT NULL,
  tax_type text NOT NULL,
  effective_year int NOT NULL,
  threshold numeric,
  rate numeric,
  base text,
  source text,
  valid_from date NOT NULL,
  valid_to date,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tax_rules_lookup_idx ON public.tax_rules (country, taxpayer_type, tax_type, effective_year);

ALTER TABLE public.tax_rules
  DROP CONSTRAINT IF EXISTS tax_rules_unique_rule_version;
ALTER TABLE public.tax_rules
  ADD CONSTRAINT tax_rules_unique_rule_version UNIQUE (country, taxpayer_type, tax_type, effective_year, version);

ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

-- Lectura abierta a cualquier usuario autenticado: es ley tributaria
-- pública, no dato privado de un tenant. Escritura reservada al service
-- role (solo el equipo de Ferova cura/verifica estos valores).
DROP POLICY IF EXISTS tax_rules_select_authenticated ON public.tax_rules;
CREATE POLICY tax_rules_select_authenticated ON public.tax_rules
  FOR SELECT TO authenticated USING (true);

-- Semilla: valores DIAN 2026 vigentes, idénticos a DEFAULT_CONFIG en
-- financeService.ts -- cero cambio de comportamiento hasta que algo lea
-- de aquí activamente.
INSERT INTO public.tax_rules (country, taxpayer_type, tax_type, effective_year, threshold, rate, base, source, valid_from, version)
VALUES
  ('CO', 'independiente', 'tope_no_declarante_uvt', 2026, 1400, NULL, 'UVT de ingresos anuales', 'DIAN', '2026-01-01', 1),
  ('CO', 'independiente', 'tope_no_paga_renta_uvt', 2026, 1090, NULL, 'UVT de ingresos anuales', 'DIAN', '2026-01-01', 1),
  ('CO', 'independiente', 'tope_responsable_iva_uvt', 2026, 3500, NULL, 'UVT de ingresos anuales (Art. 437 E.T.)', 'DIAN', '2026-01-01', 1),
  ('CO', 'independiente', 'retencion_servicio_min_uvt', 2026, 4, NULL, 'UVT del pago o abono en cuenta', 'DIAN', '2026-01-01', 1),
  ('CO', 'declarante', 'tarifa_retencion_servicios', 2026, NULL, 0.04, 'Valor bruto del servicio', 'DIAN', '2026-01-01', 1),
  ('CO', 'no_declarante', 'tarifa_retencion_servicios', 2026, NULL, 0.06, 'Valor bruto del servicio', 'DIAN', '2026-01-01', 1),
  ('CO', 'independiente', 'tarifa_salud', 2026, NULL, 0.125, 'IBC (Ingreso Base de Cotización)', 'Ministerio de Salud', '2026-01-01', 1),
  ('CO', 'independiente', 'tarifa_pension', 2026, NULL, 0.16, 'IBC (Ingreso Base de Cotización)', 'Ministerio del Trabajo', '2026-01-01', 1),
  ('CO', 'independiente', 'ibc_porcentaje', 2026, NULL, 0.40, 'Ingresos brutos mensuales', 'Ley 1955 de 2019', '2026-01-01', 1),
  ('CO', 'responsable_iva', 'tarifa_iva', 2026, NULL, 0.19, 'Valor del servicio gravado', 'DIAN', '2026-01-01', 1),
  ('CO', 'todos', 'uvt', 2026, 52374, NULL, 'Valor UVT del año gravable', 'DIAN', '2026-01-01', 1),
  ('CO', 'todos', 'smmlv', 2026, 1750905, NULL, 'Salario mínimo mensual legal vigente', 'Gobierno de Colombia', '2026-01-01', 1)
ON CONFLICT (country, taxpayer_type, tax_type, effective_year, version) DO NOTHING;

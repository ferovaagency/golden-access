// Cálculos deterministas de ROI para el módulo de marketing.
// Todas las tasas devuelven 0 cuando el denominador es 0 para evitar Infinity/NaN.

export interface CampaignMetricsInput {
  inversion: number;
  impresiones: number;
  clics: number;
  leads: number;
  leads_calificados: number;
  citas: number;
  citas_efectivas: number;
  ventas: number;
  ticket_promedio: number;
  costo_entrega: number;
  comision: number;
  ltv: number;
}

export interface RoiResult {
  cpm: number;
  ctr: number;
  cpc: number;
  cpl: number;
  cpl_calificado: number;
  tasa_lead_a_calificado: number;
  tasa_calificado_a_cita: number;
  tasa_cita_a_efectiva: number;
  tasa_efectiva_a_venta: number;
  fuga_leads: number;
  fuga_citas: number;
  cpa: number;
  ingresos_brutos: number;
  roas: number;
  utilidad_neta: number;
  margen_neto: number;
  roi: number;
  ltv_total: number;
}

const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

export function computeRoi(m: CampaignMetricsInput): RoiResult {
  const cpm = safeDiv(m.inversion, m.impresiones) * 1000;
  const ctr = safeDiv(m.clics, m.impresiones);
  const cpc = safeDiv(m.inversion, m.clics);
  const cpl = safeDiv(m.inversion, m.leads);
  const cpl_calificado = safeDiv(m.inversion, m.leads_calificados);
  const tasa_lead_a_calificado = safeDiv(m.leads_calificados, m.leads);
  const tasa_calificado_a_cita = safeDiv(m.citas, m.leads_calificados);
  const tasa_cita_a_efectiva = safeDiv(m.citas_efectivas, m.citas);
  const tasa_efectiva_a_venta = safeDiv(m.ventas, m.citas_efectivas);
  const fuga_leads = Math.max(0, m.leads - m.leads_calificados);
  const fuga_citas = Math.max(0, m.citas - m.citas_efectivas);
  const cpa = safeDiv(m.inversion, m.ventas);
  const ingresos_brutos = m.ventas * m.ticket_promedio;
  const roas = safeDiv(ingresos_brutos, m.inversion);
  const costos_totales = m.inversion + m.costo_entrega * m.ventas + m.comision * m.ventas;
  const utilidad_neta = ingresos_brutos - costos_totales;
  const margen_neto = safeDiv(utilidad_neta, ingresos_brutos);
  const roi = safeDiv(utilidad_neta, m.inversion);
  const ltv_total = m.ventas * m.ltv;
  return { cpm, ctr, cpc, cpl, cpl_calificado, tasa_lead_a_calificado, tasa_calificado_a_cita, tasa_cita_a_efectiva, tasa_efectiva_a_venta, fuga_leads, fuga_citas, cpa, ingresos_brutos, roas, utilidad_neta, margen_neto, roi, ltv_total };
}

export interface ReverseRoiInput {
  meta_facturacion: number;
  ticket_promedio: number;
  tasa_efectiva_a_venta: number; // 0..1
  tasa_cita_a_efectiva: number;
  tasa_calificado_a_cita: number;
  tasa_lead_a_calificado: number;
  ctr: number;
  cpc: number;
}

export interface ReverseRoiResult {
  ventas: number;
  citas_efectivas: number;
  citas: number;
  leads_calificados: number;
  leads: number;
  clics: number;
  impresiones: number;
  inversion: number;
}

export function reverseRoi(i: ReverseRoiInput): ReverseRoiResult {
  const ventas = i.ticket_promedio > 0 ? Math.ceil(i.meta_facturacion / i.ticket_promedio) : 0;
  const citas_efectivas = i.tasa_efectiva_a_venta > 0 ? Math.ceil(ventas / i.tasa_efectiva_a_venta) : 0;
  const citas = i.tasa_cita_a_efectiva > 0 ? Math.ceil(citas_efectivas / i.tasa_cita_a_efectiva) : 0;
  const leads_calificados = i.tasa_calificado_a_cita > 0 ? Math.ceil(citas / i.tasa_calificado_a_cita) : 0;
  const leads = i.tasa_lead_a_calificado > 0 ? Math.ceil(leads_calificados / i.tasa_lead_a_calificado) : 0;
  const clics = leads; // supuesto 1 lead = 1 clic útil
  const impresiones = i.ctr > 0 ? Math.ceil(clics / i.ctr) : 0;
  const inversion = Math.ceil(clics * i.cpc);
  return { ventas, citas_efectivas, citas, leads_calificados, leads, clics, impresiones, inversion };
}

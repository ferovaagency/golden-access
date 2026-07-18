// Shared aggregator: builds a single Business Intelligence snapshot payload
// for the given user by reading finance + CRM + planner tables. All BI edge
// functions (bi-compute-health, bi-detect-blindspots, ceo-report-generate)
// consume this same shape so scoring/insights stay consistent.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const MS_DAY = 86_400_000;

export interface BIContext {
  userId: string;
  today: string; // YYYY-MM-DD
  profile: { nombre_negocio?: string; industria?: string; tipo_negocio?: string; tamano_equipo?: number; ciudad?: string } | null;
  overview: Record<string, any> | null;
  services: Array<{ servicio_nombre: string; ingresos_brutos: number; costos_directos: number; margen_bruto: number; ventas_count: number; horas_registradas: number }>;
  clients: Array<{ id: string; nombre: string; tipo: string; activo: boolean; progreso: number; responsable?: string }>;
  sales: Array<{ id: string; fecha: string; cliente_id: string; servicio_id: string; cliente_nombre: string; servicio_nombre: string; precio_venta_unitario: number; cantidad: number; costo_unitario: number; moneda: string; adelanto: number; estado_pago: string }>;
  expenses: Array<{ id: string; fecha: string; concepto: string; categoria: string; monto: number; moneda: string }>;
  hours: Array<{ id: string; fecha: string; cliente_id: string; servicio_id: string; cliente_nombre: string; servicio_nombre: string; horas: number }>;
  salesPayments: Array<{ venta_id: string; fecha: string; monto: number }>;
  receivablePayments: Array<{ fecha: string; monto: number; moneda: string }>;
  payablePayments: Array<{ fecha: string; monto: number; moneda: string }>;
  debtPayments: Array<{ fecha: string; monto: number; moneda: string }>;
  receivables: Array<{ valor: number; moneda: string; estado: string }>;
  payables: Array<{ valor: number; monto_pagado: number | null; moneda: string; estado: string }>;
  opportunities: Array<{ id: string; nombre_contacto: string; empresa?: string; canal_origen?: string; estado: string; valor_estimado?: number; moneda?: string; siguiente_accion?: string; updated_at: string }>;
  reviews: Array<{ id: string; plataforma: string; calificacion: number; respondida: boolean; detectada_en: string }>;
  tasks: Array<{ id: string; title: string; status: string; priority: string; deadline?: string | null; scheduled_for?: string | null; postponed_count?: number | null; completed_at?: string | null; created_at: string }>;
  meta: {
    trm: number;
    horas_objetivo_mes: number;
    meta_ventas_mensual: number;
    salario_propuesto: number;
  };
}

export async function loadBIContext(admin: SupabaseClient, userId: string): Promise<BIContext> {
  const today = new Date();
  const since = new Date(today.getTime() - 90 * MS_DAY).toISOString();

  const [profile, overview, services, clients, rawSales, expenses, rawHours, salesPayments, receivablePayments, payablePayments, debtPayments, receivables, payables, opps, reviews, tasks, config] = await Promise.all([
    admin.from("business_profile").select("nombre_negocio, industria, tipo_negocio, tamano_equipo, ciudad").eq("user_id", userId).maybeSingle(),
    admin.from("business_overview").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("finance_service_profitability").select("servicio_nombre, ingresos_brutos, costos_directos, margen_bruto, ventas_count, horas_registradas").eq("user_id", userId),
    admin.from("finance_clientes").select("id, nombre, tipo, activo, progreso, responsable").eq("user_id", userId),
    admin.from("finance_ventas").select("id, fecha, cliente_id, servicio_id, precio_venta_unitario, cantidad, costo_unitario, moneda, adelanto, estado_pago").eq("user_id", userId).gte("fecha", since.slice(0, 10)),
    admin.from("finance_pagos_egresos").select("id, fecha, concepto, categoria, monto, moneda").eq("user_id", userId).gte("fecha", since.slice(0, 10)),
    admin.from("finance_horas").select("id, fecha, cliente_id, servicio_id, horas").eq("user_id", userId).gte("fecha", since.slice(0, 10)),
    admin.from("finance_abonos").select("venta_id, fecha, monto").eq("user_id", userId).gte("fecha", since.slice(0, 10)),
    admin.from("finance_receivable_payments").select("fecha, monto, finance_receivables(moneda)").eq("user_id", userId).gte("fecha", since.slice(0, 10)),
    admin.from("finance_payables").select("fecha_pago_real, monto_pagado, moneda").eq("user_id", userId).not("fecha_pago_real", "is", null).gte("fecha_pago_real", since.slice(0, 10)),
    admin.from("finance_debt_payments").select("fecha, monto, finance_debts(moneda)").eq("user_id", userId).gte("fecha", since.slice(0, 10)),
    admin.from("finance_receivables").select("valor, moneda, estado").eq("user_id", userId),
    admin.from("finance_payables").select("valor, monto_pagado, moneda, estado").eq("user_id", userId),
    admin.from("crm_oportunidades").select("id, nombre_contacto, empresa, canal_origen, estado, valor_estimado, moneda, siguiente_accion, updated_at").order("updated_at", { ascending: false }).limit(50),
    admin.from("crm_resenas").select("id, plataforma, calificacion, respondida, detectada_en").order("detectada_en", { ascending: false }).limit(30),
    admin.from("planner_tasks").select("id, title, status, priority, deadline, scheduled_for, postponed_count, completed_at, created_at").eq("user_id", userId).gte("created_at", since),
    admin.from("finance_config").select("trm, horas_objetivo_mes, meta_ventas_mensual, salario_propuesto").eq("user_id", userId).maybeSingle(),
  ]);

  const queries: Array<[string, any]> = [
    ["perfil", profile], ["resumen", overview], ["rentabilidad por servicio", services], ["clientes", clients],
    ["ventas", rawSales], ["egresos", expenses], ["horas", rawHours], ["abonos de ventas", salesPayments],
    ["cobros de cartera", receivablePayments], ["pagos de cuentas", payablePayments], ["pagos de deudas", debtPayments],
    ["cuentas por cobrar", receivables], ["cuentas por pagar", payables], ["oportunidades", opps],
    ["reseñas", reviews], ["tareas", tasks], ["configuración", config],
  ];
  for (const [label, result] of queries) {
    if (result.error) throw new Error(`[BI] No se pudo leer ${label}: ${result.error.message}`);
  }

  const clientName = new Map((clients.data || []).map((client: any) => [client.id, client.nombre]));
  const serviceNameRows = await admin.from("finance_servicios").select("id, nombre").eq("user_id", userId);
  if (serviceNameRows.error) throw new Error(`[BI] No se pudo leer servicios: ${serviceNameRows.error.message}`);
  const serviceName = new Map((serviceNameRows.data || []).map((service: any) => [service.id, service.nombre]));
  const sales = (rawSales.data || []).map((sale: any) => ({ ...sale, cliente_nombre: clientName.get(sale.cliente_id) || "Cliente sin nombre", servicio_nombre: serviceName.get(sale.servicio_id) || "Servicio sin nombre" }));
  const hours = (rawHours.data || []).map((hour: any) => ({ ...hour, cliente_nombre: clientName.get(hour.cliente_id) || "Cliente sin nombre", servicio_nombre: serviceName.get(hour.servicio_id) || "Servicio sin nombre" }));

  return {
    userId,
    today: today.toISOString().slice(0, 10),
    profile: profile.data || null,
    overview: overview.data || null,
    services: services.data || [],
    clients: clients.data || [],
    sales,
    expenses: expenses.data || [],
    hours,
    salesPayments: salesPayments.data || [],
    receivablePayments: (receivablePayments.data || []).map((payment: any) => ({ fecha: payment.fecha, monto: Number(payment.monto), moneda: payment.finance_receivables?.moneda || "COP" })),
    payablePayments: (payablePayments.data || []).map((payment: any) => ({ fecha: payment.fecha_pago_real, monto: Number(payment.monto_pagado || 0), moneda: payment.moneda || "COP" })),
    debtPayments: (debtPayments.data || []).map((payment: any) => ({ fecha: payment.fecha, monto: Number(payment.monto), moneda: payment.finance_debts?.moneda || "COP" })),
    receivables: (receivables.data || []).map((item: any) => ({ valor: Number(item.valor), moneda: item.moneda || "COP", estado: item.estado })),
    payables: (payables.data || []).map((item: any) => ({ valor: Number(item.valor), monto_pagado: item.monto_pagado == null ? null : Number(item.monto_pagado), moneda: item.moneda || "COP", estado: item.estado })),
    opportunities: opps.data || [],
    reviews: reviews.data || [],
    tasks: tasks.data || [],
    meta: {
      trm: Number(config.data?.trm) || 4000,
      horas_objetivo_mes: Number(config.data?.horas_objetivo_mes) || 160,
      meta_ventas_mensual: Number(config.data?.meta_ventas_mensual) || 0,
      salario_propuesto: Number(config.data?.salario_propuesto) || 0,
    },
  };
}

/** Normalize any amount to COP using stored TRM (rough — informational). */
export function toCop(amount: number, currency: string, trm: number): number {
  if (!amount) return 0;
  if ((currency || "COP").toUpperCase() === "USD") return amount * trm;
  return amount;
}

/** Days between two YYYY-MM-DD dates (or ISO). */
export function daysBetween(a: string | Date, b: string | Date): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.round((db.getTime() - da.getTime()) / MS_DAY);
}

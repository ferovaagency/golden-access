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
  sales: Array<{ id: string; fecha: string; cliente_id: string; cliente_nombre: string; servicio_nombre: string; precio_venta_unitario: number; cantidad: number; costo_unitario: number; moneda: string; adelanto: number; estado_pago: string }>;
  expenses: Array<{ id: string; fecha: string; concepto: string; categoria: string; monto: number; moneda: string }>;
  hours: Array<{ id: string; fecha: string; cliente_nombre: string; servicio_nombre: string; horas: number }>;
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

  const [profile, overview, services, clients, sales, expenses, hours, opps, reviews, tasks, config] = await Promise.all([
    admin.from("business_profile").select("nombre_negocio, industria, tipo_negocio, tamano_equipo, ciudad").eq("user_id", userId).maybeSingle(),
    admin.from("business_overview").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("finance_service_profitability").select("servicio_nombre, ingresos_brutos, costos_directos, margen_bruto, ventas_count, horas_registradas").eq("user_id", userId),
    admin.from("finance_clientes").select("id, nombre, tipo, activo, progreso, responsable").eq("user_id", userId),
    admin.from("finance_ventas").select("id, fecha, cliente_id, cliente_nombre, servicio_nombre, precio_venta_unitario, cantidad, costo_unitario, moneda, adelanto, estado_pago").eq("user_id", userId).gte("fecha", since.slice(0, 10)),
    admin.from("finance_pagos_egresos").select("id, fecha, concepto, categoria, monto, moneda").eq("user_id", userId).gte("fecha", since.slice(0, 10)),
    admin.from("finance_horas").select("id, fecha, cliente_nombre, servicio_nombre, horas").eq("user_id", userId).gte("fecha", since.slice(0, 10)),
    admin.from("crm_oportunidades").select("id, nombre_contacto, empresa, canal_origen, estado, valor_estimado, moneda, siguiente_accion, updated_at").order("updated_at", { ascending: false }).limit(50),
    admin.from("crm_resenas").select("id, plataforma, calificacion, respondida, detectada_en").order("detectada_en", { ascending: false }).limit(30),
    admin.from("planner_tasks").select("id, title, status, priority, deadline, scheduled_for, postponed_count, completed_at, created_at").eq("user_id", userId).gte("created_at", since),
    admin.from("finance_config").select("trm, horas_objetivo_mes, meta_ventas_mensual, salario_propuesto").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    userId,
    today: today.toISOString().slice(0, 10),
    profile: profile.data || null,
    overview: overview.data || null,
    services: services.data || [],
    clients: clients.data || [],
    sales: sales.data || [],
    expenses: expenses.data || [],
    hours: hours.data || [],
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

import { supabase } from './supabase';
import {
  AppData,
  Config,
  Cliente,
  Servicio,
  Herramienta,
  OtroGasto,
  PagoEgreso,
  Venta,
  Hora,
} from '../types';

/**
 * FINANCE SERVICE - Supabase como fuente de verdad
 *
 * Reemplaza a sheetsService.ts como almacenamiento primario. Cada tabla vive
 * en Supabase con RLS por user_id (una fila por agencia/cliente de Ferova OS).
 * Google Sheets pasa a ser un respaldo opcional manual (ver backupAppDataToSheets
 * en sheetsService.ts), no la base de datos activa.
 */

const DEFAULT_CONFIG: Omit<Config, never> = {
  trm: 4000,
  uvt: 52374,
  smmlv: 1750905,
  tope_no_declarante_uvt: 1400,
  tope_no_paga_renta_uvt: 1090,
  tope_responsable_iva_uvt: 3500,
  retencion_servicio_min_uvt: 4,
  tarifa_ret_declarante: 0.04,
  tarifa_ret_no_declarante: 0.06,
  tarifa_salud: 0.125,
  tarifa_pension: 0.16,
  ibc_porcentaje: 0.40,
  tarifa_iva: 0.19,
  salario_propuesto: 4000000,
  horas_objetivo_mes: 160,
  meta_ventas_mensual: 12000000,
  margen_minimo: 0.30,
  umbral_perdida_horas: 0.75,
};

function throwIfError<T>(label: string, res: { data: T; error: any }): T {
  if (res.error) throw new Error(`[financeService] ${label}: ${res.error.message}`);
  return res.data;
}

async function loadConfig(userId: string): Promise<Config> {
  const res = await supabase.from('finance_config').select('*').eq('user_id', userId).maybeSingle();
  if (res.error) throw new Error(`[financeService] loadConfig: ${res.error.message}`);
  if (res.data) {
    const { user_id, updated_at, ...config } = res.data as any;
    return { ...DEFAULT_CONFIG, ...config } as Config;
  }
  // Multiple screens can load finance data at the same time after sign-in.
  // Seed once and let the subsequent read return the canonical row instead
  // of failing when another request won the race to insert it.
  const insertRes = await supabase
    .from('finance_config')
    .upsert({ user_id: userId, ...DEFAULT_CONFIG }, { onConflict: 'user_id', ignoreDuplicates: true });
  throwIfError('loadConfig (seed)', insertRes as any);

  const createdRes = await supabase.from('finance_config').select('*').eq('user_id', userId).single();
  const created = throwIfError('loadConfig (seed read)', createdRes as any);
  const { user_id, updated_at, ...config } = created as any;
  return { ...DEFAULT_CONFIG, ...config } as Config;
}

export async function loadFinanceData(userId: string): Promise<AppData> {
  const [
    config,
    clientesRes,
    serviciosRes,
    herramientasRes,
    herrServRes,
    otrosGastosRes,
    pagosEgresosRes,
    ventasRes,
    abonosRes,
    horasRes,
  ] = await Promise.all([
    loadConfig(userId),
    supabase.from('finance_clientes').select('*').eq('user_id', userId),
    supabase.from('finance_servicios').select('*').eq('user_id', userId),
    supabase.from('finance_herramientas').select('*').eq('user_id', userId),
    supabase.from('finance_herramienta_servicios').select('*').eq('user_id', userId),
    supabase.from('finance_otros_gastos').select('*').eq('user_id', userId),
    supabase.from('finance_pagos_egresos').select('*').eq('user_id', userId),
    supabase.from('finance_ventas').select('*').eq('user_id', userId),
    supabase.from('finance_abonos').select('*').eq('user_id', userId),
    supabase.from('finance_horas').select('*').eq('user_id', userId),
  ]);

  const clientesRaw = throwIfError('clientes', clientesRes as any) as any[];
  const serviciosRaw = throwIfError('servicios', serviciosRes as any) as any[];
  const herramientasRaw = throwIfError('herramientas', herramientasRes as any) as any[];
  const herrServRaw = throwIfError('herramienta_servicios', herrServRes as any) as any[];
  const otrosGastosRaw = throwIfError('otros_gastos', otrosGastosRes as any) as any[];
  const pagosEgresosRaw = throwIfError('pagos_egresos', pagosEgresosRes as any) as any[];
  const ventasRaw = throwIfError('ventas', ventasRes as any) as any[];
  const abonosRaw = throwIfError('abonos', abonosRes as any) as any[];
  const horasRaw = throwIfError('horas', horasRes as any) as any[];

  const clienteNombreMap = new Map(clientesRaw.map((c) => [c.id, c.nombre]));
  const servicioNombreMap = new Map(serviciosRaw.map((s) => [s.id, s.nombre]));

  const clientes: Cliente[] = clientesRaw.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    declarante: c.declarante,
    activo: c.activo,
    fecha_creacion: c.fecha_creacion,
    notas: c.notas ?? undefined,
    marca_info: c.marca_info ?? undefined,
    objetivos: c.objetivos ?? undefined,
    kpis: c.kpis ?? undefined,
    entregables: c.entregables ?? undefined,
    progreso: c.progreso ?? undefined,
    responsable: c.responsable ?? undefined,
  }));

  const servicios: Servicio[] = serviciosRaw.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    costo_unitario: Number(s.costo_unitario),
    descripcion: s.descripcion ?? undefined,
    costo_entrega_estimado: s.costo_entrega_estimado != null ? Number(s.costo_entrega_estimado) : null,
    margen_objetivo: s.margen_objetivo != null ? Number(s.margen_objetivo) : null,
    precio_habitual: s.precio_habitual != null ? Number(s.precio_habitual) : null,
    precio_habitual_moneda: (s.precio_habitual_moneda as 'COP' | 'USD') || 'COP',
    precio_ofrecido: s.precio_ofrecido != null ? Number(s.precio_ofrecido) : null,
  }));

  const herramientas: Herramienta[] = herramientasRaw.map((h) => ({
    id: h.id,
    nombre: h.nombre,
    monto: Number(h.monto),
    moneda: h.moneda,
    tipo_cobro: h.tipo_cobro,
    servicios_ids: herrServRaw
      .filter((hs) => hs.herramienta_id === h.id)
      .map((hs) => hs.servicio_id)
      .join(','),
    notas: h.notas ?? undefined,
  }));

  const otrosGastos: OtroGasto[] = otrosGastosRaw.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    monto: Number(g.monto),
    moneda: g.moneda,
    categoria: g.categoria,
    comprobante_url: g.comprobante_url ?? undefined,
    comprobante_nombre: g.comprobante_nombre ?? undefined,
  }));

  const pagosEgresos: PagoEgreso[] = pagosEgresosRaw.map((p) => ({
    id: p.id,
    fecha: p.fecha,
    concepto: p.concepto,
    categoria: p.categoria,
    monto: Number(p.monto),
    moneda: p.moneda,
    metodo_pago: p.metodo_pago ?? '',
    notas: p.notas ?? undefined,
    comprobante_url: p.comprobante_url ?? undefined,
    comprobante_nombre: p.comprobante_nombre ?? undefined,
  }));

  const ventas: Venta[] = ventasRaw.map((v) => ({
    id: v.id,
    fecha: v.fecha,
    cliente_id: v.cliente_id,
    cliente_nombre: clienteNombreMap.get(v.cliente_id) || 'Cliente',
    servicio_id: v.servicio_id,
    servicio_nombre: servicioNombreMap.get(v.servicio_id) || 'Servicio',
    cantidad: Number(v.cantidad),
    precio_venta_unitario: Number(v.precio_venta_unitario),
    costo_unitario: Number(v.costo_unitario),
    moneda: v.moneda,
    tipo: v.tipo,
    adelanto: Number(v.adelanto),
    estado_pago: v.estado_pago,
    notas: v.notas ?? undefined,
    abonos: abonosRaw
      .filter((a) => a.venta_id === v.id)
      .map((a) => ({
        fecha: a.fecha,
        monto: Number(a.monto),
        tipo_pago: a.tipo_pago ?? undefined,
        notas: a.notas ?? undefined,
      })),
  }));

  const horas: Hora[] = horasRaw.map((h) => ({
    id: h.id,
    fecha: h.fecha,
    cliente_id: h.cliente_id,
    cliente_nombre: clienteNombreMap.get(h.cliente_id) || 'Cliente',
    servicio_id: h.servicio_id,
    servicio_nombre: servicioNombreMap.get(h.servicio_id) || 'Servicio',
    horas: Number(h.horas),
    descripcion: h.descripcion || '',
  }));

  return {
    config,
    clientes,
    servicios,
    herramientas,
    otrosGastos,
    ventas,
    horas,
    respaldos: [],
    pagosEgresos,
  };
}

async function overwriteTable(table: string, userId: string, rows: Record<string, any>[]) {
  const client = supabase as any;
  const delRes = await client.from(table).delete().eq('user_id', userId);
  if (delRes.error) throw new Error(`[financeService] overwrite ${table} (delete): ${delRes.error.message}`);
  if (rows.length === 0) return;
  const insRes = await client.from(table).insert(rows.map((r) => ({ ...r, user_id: userId })));
  if (insRes.error) throw new Error(`[financeService] overwrite ${table} (insert): ${insRes.error.message}`);
}

export async function saveImportedFinanceData(userId: string, data: AppData) {
  await saveConfig(userId, data.config);
  await saveClientes(userId, data.clientes);
  await saveServicios(userId, data.servicios);
  await saveHerramientas(userId, data.herramientas);
  await saveOtrosGastos(userId, data.otrosGastos);
  await savePagosEgresos(userId, data.pagosEgresos || []);
  await saveVentas(userId, data.ventas);
  await saveHoras(userId, data.horas);
}

export async function saveClientes(userId: string, list: Cliente[]) {
  await overwriteTable('finance_clientes', userId, list.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo,
    declarante: c.declarante,
    activo: c.activo,
    fecha_creacion: c.fecha_creacion,
    notas: c.notas || null,
    marca_info: c.marca_info || null,
    objetivos: c.objetivos || null,
    kpis: c.kpis || null,
    entregables: c.entregables || null,
    progreso: c.progreso ?? null,
    responsable: c.responsable || null,
  })));
}

export async function saveServicios(userId: string, list: Servicio[]) {
  await overwriteTable('finance_servicios', userId, list.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    costo_unitario: s.costo_unitario,
    descripcion: s.descripcion || null,
    // Preservamos precios históricos y ofrecidos: solo se sobrescriben si el
    // usuario los editó explícitamente en el formulario.
    costo_entrega_estimado: s.costo_entrega_estimado ?? null,
    margen_objetivo: s.margen_objetivo ?? null,
    precio_habitual: s.precio_habitual ?? null,
    precio_habitual_moneda: s.precio_habitual_moneda || 'COP',
    precio_ofrecido: s.precio_ofrecido ?? null,
  })));
}

export async function saveHerramientas(userId: string, list: Herramienta[]) {
  await overwriteTable('finance_herramientas', userId, list.map((h) => ({
    id: h.id,
    nombre: h.nombre,
    monto: h.monto,
    moneda: h.moneda,
    tipo_cobro: h.tipo_cobro,
    notas: h.notas || null,
  })));

  const junctionRows = list.flatMap((h) =>
    (h.servicios_ids ? h.servicios_ids.split(',').map((s) => s.trim()).filter(Boolean) : []).map((servicioId) => ({
      herramienta_id: h.id,
      servicio_id: servicioId,
    }))
  );
  await overwriteTable('finance_herramienta_servicios', userId, junctionRows);
}

export async function saveOtrosGastos(userId: string, list: OtroGasto[]) {
  await overwriteTable('finance_otros_gastos', userId, list.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    monto: g.monto,
    moneda: g.moneda,
    categoria: g.categoria,
    comprobante_url: g.comprobante_url || null,
    comprobante_nombre: g.comprobante_nombre || null,
  })));
}

export async function savePagosEgresos(userId: string, list: PagoEgreso[]) {
  await overwriteTable('finance_pagos_egresos', userId, list.map((p) => ({
    id: p.id,
    fecha: p.fecha,
    concepto: p.concepto,
    categoria: p.categoria,
    monto: p.monto,
    moneda: p.moneda,
    metodo_pago: p.metodo_pago || null,
    notas: p.notas || null,
    comprobante_url: p.comprobante_url || null,
    comprobante_nombre: p.comprobante_nombre || null,
  })));
}

export async function saveVentas(userId: string, list: Venta[]) {
  await overwriteTable('finance_ventas', userId, list.map((v) => ({
    id: v.id,
    fecha: v.fecha,
    cliente_id: v.cliente_id,
    servicio_id: v.servicio_id,
    cantidad: v.cantidad,
    precio_venta_unitario: v.precio_venta_unitario,
    costo_unitario: v.costo_unitario,
    moneda: v.moneda,
    tipo: v.tipo,
    adelanto: v.adelanto,
    estado_pago: v.estado_pago,
    notas: v.notas || null,
  })));

  const abonoRows = list.flatMap((v) =>
    (v.abonos || []).map((a) => ({
      venta_id: v.id,
      fecha: a.fecha,
      monto: a.monto,
      tipo_pago: a.tipo_pago || null,
      notas: a.notas || null,
    }))
  );
  await overwriteTable('finance_abonos', userId, abonoRows);
}

export async function saveHoras(userId: string, list: Hora[]) {
  await overwriteTable('finance_horas', userId, list.map((h) => ({
    id: h.id,
    fecha: h.fecha,
    cliente_id: h.cliente_id,
    servicio_id: h.servicio_id,
    horas: h.horas,
    descripcion: h.descripcion || null,
  })));
}

export async function saveConfig(userId: string, config: Config) {
  const res = await supabase.from('finance_config').upsert({ user_id: userId, ...config, updated_at: new Date().toISOString() });
  if (res.error) throw new Error(`[financeService] saveConfig: ${res.error.message}`);
}

export interface OfficialTrm {
  trm: number;
  source: string;
  vigente_desde: string | null;
}

// Trae la TRM oficial (datos.gov.co, con fallback a currency-api) para precargar el
// campo del formulario -- el usuario sigue confirmando manualmente con "Actualizar
// Parámetros", nunca se sobreescribe solo.
export async function fetchOfficialTrm(): Promise<OfficialTrm> {
  const { data, error } = await supabase.functions.invoke('trm-fetch', { body: {} });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || 'No se pudo obtener la TRM oficial.');
  return { trm: data.trm, source: data.source, vigente_desde: data.vigente_desde ?? null };
}

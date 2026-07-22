/**
 * Reading/parsing the "Ferova_OS_Financiero" spreadsheet into AppData --
 * both the OAuth batchGet path and the public-CSV backend import path share
 * mapValuesToAppData. Split out of sheetsService.ts (Fase 3 del roadmap).
 */
import { Config, Cliente, Servicio, Herramienta, OtroGasto, Venta, Hora, Respaldo, AppData, PagoEgreso } from '../../types';
import { ensureSingleWorksheetExists } from './spreadsheetSchema';

/**
 * Fetches all ranges from our sheets at once with graceful 8-sheet fallback.
 */
export async function fetchSpreadsheetData(spreadsheetId: string, accessToken: string): Promise<AppData> {
  const coreSheets = [
    { name: 'Config', range: 'Config!A1:P2' },
    { name: 'Clientes', range: 'Clientes!A1:Z2000' },
    { name: 'Servicios', range: 'Servicios!A1:Z2000' },
    { name: 'Herramientas', range: 'Herramientas!A1:Z2000' },
    { name: 'OtrosGastos', range: 'OtrosGastos!A1:Z2000' },
    { name: 'Ventas', range: 'Ventas!A1:Z5000' },
    { name: 'Horas', range: 'Horas!A1:Z5000' },
    { name: 'Respaldos', range: 'Respaldos!A1:Z1000' },
    { name: 'PagosEgresos', range: 'PagosEgresos!A1:Z5000' }
  ];

  let valueRanges: any[] = [];
  let loadedAllNine = false;

  try {
    const queryParams = coreSheets.map(item => `ranges=${encodeURIComponent(item.range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryParams}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) {
      const data = await res.json();
      valueRanges = data.valueRanges || [];
      loadedAllNine = true;
    } else {
      console.warn(`Fetch with 9 sheets returned status ${res.status}. Falling back to 8 core sheets.`);
    }
  } catch (err) {
    console.warn('9-sheets direct fetch threw error, using fallback:', err);
  }

  if (!loadedAllNine) {
    const fallbackSheets = coreSheets.slice(0, 8);
    const queryParams = fallbackSheets.map(item => `ranges=${encodeURIComponent(item.range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryParams}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`Error trayendo datos de Sheets (8 core sheets): ${res.statusText || 'Respuesta no exitosa'}`);
    }
    const data = await res.json();
    valueRanges = data.valueRanges || [];
    ensureSingleWorksheetExists(spreadsheetId, accessToken, 'PagosEgresos').catch(err => {
      console.error("Background auto-upgrade of 'PagosEgresos' failed:", err);
    });
  }

  // Convertir valueRanges (formato Google API) a un mapa {sheetName: values[][]}
  const valuesBySheet: Record<string, any[][]> = {};
  for (const vr of valueRanges) {
    if (!vr?.range) continue;
    const sheetName = vr.range.replace(/'/g, '').split('!')[0];
    valuesBySheet[sheetName] = vr.values || [];
  }
  return mapValuesToAppData(valuesBySheet);
}

/**
 * Import via backend edge function. Uses public CSV endpoint — the sheet must be shared
 * as "Anyone with the link can view". No Google OAuth token required.
 */
export async function importSheetByUrl(url: string, accessToken?: string | null): Promise<AppData> {
  const { supabase } = await import('../../integrations/supabase/client');
  const { data, error } = await supabase.functions.invoke('sheets-import', { body: { url, access_token: accessToken || undefined } });
  if (error) {
    const details = (error as any)?.context && typeof (error as any).context.text === 'function'
      ? await (error as any).context.text().catch(() => null)
      : null;
    throw new Error(details || (error as Error).message || 'No se pudo importar desde el link');
  }
  if (!data?.ok) throw new Error(`${data?.message || 'No se pudo importar desde el link'}${data?.details ? `\n${data.details}` : ''}`);
  return mapValuesToAppData(data.values as Record<string, any[][]>);
}

function normalizeKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function text(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = text(value);
  if (!raw) return 0;
  const normalized = raw
    .replace(/[$\s]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanId(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const num = Number(raw);
  if (Number.isFinite(num) && (/^[+-]?\d+(\.0+)?$/i.test(raw) || /^[+-]?\d+(\.\d+)?e[+-]?\d+$/i.test(raw))) {
    return Math.trunc(num).toLocaleString('fullwide', { useGrouping: false });
  }
  return raw;
}

function toBool(value: unknown, defaultValue = false): boolean {
  const normalized = normalizeKey(value);
  if (!normalized) return defaultValue;
  if (['true', '1', 'si', 's', 'yes', 'y', 'activo', 'activa'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'inactivo', 'inactiva'].includes(normalized)) return false;
  return defaultValue;
}

function toDateString(value: unknown): string {
  if (value == null || text(value) === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = text(value);
  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 25000 && serial < 70000) {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + serial * 86_400_000).toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime()) && /[-/T]|\d{4}/.test(raw)) return parsed.toISOString().slice(0, 10);
  return raw;
}

function normalizeTipo(value: unknown): 'Nacional' | 'Internacional' {
  return normalizeKey(value).includes('internacional') ? 'Internacional' : 'Nacional';
}

function normalizeMoneda(value: unknown): 'COP' | 'USD' {
  return text(value).toUpperCase() === 'USD' ? 'USD' : 'COP';
}

function normalizeTipoCobro(value: unknown): 'global' | 'porCliente' {
  const normalized = normalizeKey(value);
  return normalized === 'porcliente' || normalized === 'por_cliente' ? 'porCliente' : 'global';
}

function normalizeEstadoPago(value: unknown): 'Pendiente' | 'Adelanto' | 'Pagado' {
  const normalized = normalizeKey(value);
  if (normalized.includes('pagado')) return 'Pagado';
  if (normalized.includes('adelanto') || normalized.includes('abono')) return 'Adelanto';
  return 'Pendiente';
}

function normalizeOtroGastoCategoria(value: unknown): 'Operativo' | 'Administrativo' | 'Otros' {
  const normalized = normalizeKey(value);
  if (normalized.includes('admin')) return 'Administrativo';
  if (normalized.includes('oper')) return 'Operativo';
  return 'Otros';
}

function normalizePagoCategoria(value: unknown): 'Herramientas' | 'Salarios' | 'Contratistas' | 'Administrativo' | 'Otros' {
  const normalized = normalizeKey(value);
  if (normalized.includes('herramient')) return 'Herramientas';
  if (normalized.includes('salario') || normalized.includes('nomina')) return 'Salarios';
  if (normalized.includes('contrat')) return 'Contratistas';
  if (normalized.includes('admin')) return 'Administrativo';
  return 'Otros';
}

function looksLikeJsonArray(value: unknown): boolean {
  const raw = text(value);
  return raw.startsWith('[') && raw.endsWith(']');
}

function numberOrDefault(value: unknown, fallback: number): number {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Parses raw sheet values (as 2D arrays keyed by tab name) into the AppData shape used by the app.
 * Shared between the OAuth-based fetch and the public-CSV backend import.
 */
export function mapValuesToAppData(valuesBySheet: Record<string, any[][]>): AppData {
  const findValuesForSheet = (sheetName: string): any[][] => {
    const direct = valuesBySheet[sheetName];
    if (direct) return direct;
    const normalized = normalizeKey(sheetName);
    const foundKey = Object.keys(valuesBySheet).find((key) => normalizeKey(key) === normalized);
    return foundKey ? valuesBySheet[foundKey] || [] : [];
  };


  const rawConfig = findValuesForSheet('Config');
  const rawClientes = findValuesForSheet('Clientes');
  const rawServicios = findValuesForSheet('Servicios');
  const rawHerramientas = findValuesForSheet('Herramientas');
  const rawOtrosGastos = findValuesForSheet('OtrosGastos');
  const rawVentas = findValuesForSheet('Ventas');
  const rawHoras = findValuesForSheet('Horas');
  const rawRespaldos = findValuesForSheet('Respaldos');
  const rawPagosEgresos = findValuesForSheet('PagosEgresos');

  // 1. Config
  const configHeaders = rawConfig[0] || [];
  const configVals = rawConfig[1] || [];
  const configMap: any = {};
  configHeaders.forEach((header: string, idx: number) => {
    configMap[normalizeKey(header)] = configVals[idx] !== undefined ? toNumber(configVals[idx]) : 0;
  });

  // El archivo original tuvo una versión de Config con 12 valores: después de
  // tarifa_ret_no_declarante venían salario_propuesto, horas_objetivo_mes y
  // meta_ventas_mensual. No debe leerse como salud/pensión/IBC.
  if (configVals.length === 12 && configHeaders.length >= 16) {
    configMap.salario_propuesto = toNumber(configVals[9]);
    configMap.horas_objetivo_mes = toNumber(configVals[10]);
    configMap.meta_ventas_mensual = toNumber(configVals[11]);
    delete configMap.tarifa_salud;
    delete configMap.tarifa_pension;
    delete configMap.ibc_porcentaje;
    delete configMap.tarifa_iva;
  }

  // Fallback defaults if config headers are broken
  const config: Config = {
    trm: numberOrDefault(configMap.trm, 4000),
    uvt: numberOrDefault(configMap.uvt, 52374),
    smmlv: numberOrDefault(configMap.smmlv, 1750905),
    tope_no_declarante_uvt: numberOrDefault(configMap.tope_no_declarante_uvt, 1400),
    tope_no_paga_renta_uvt: numberOrDefault(configMap.tope_no_paga_renta_uvt, 1090),
    tope_responsable_iva_uvt: numberOrDefault(configMap.tope_responsable_iva_uvt, 3500),
    retencion_servicio_min_uvt: numberOrDefault(configMap.retencion_servicio_min_uvt, 4),
    tarifa_ret_declarante: numberOrDefault(configMap.tarifa_ret_declarante, 0.04),
    tarifa_ret_no_declarante: numberOrDefault(configMap.tarifa_ret_no_declarante, 0.06),
    tarifa_salud: numberOrDefault(configMap.tarifa_salud, 0.125),
    tarifa_pension: numberOrDefault(configMap.tarifa_pension, 0.16),
    ibc_porcentaje: numberOrDefault(configMap.ibc_porcentaje, 0.40),
    tarifa_iva: numberOrDefault(configMap.tarifa_iva, 0.19),
    salario_propuesto: numberOrDefault(configMap.salario_propuesto, 4000000),
    horas_objetivo_mes: numberOrDefault(configMap.horas_objetivo_mes, 160),
    meta_ventas_mensual: numberOrDefault(configMap.meta_ventas_mensual, 12000000),
    margen_minimo: numberOrDefault(configMap.margen_minimo, 0.30),
    umbral_perdida_horas: numberOrDefault(configMap.umbral_perdida_horas, 0.75),
  };

  // 2. Clientes mapping
  const clientes: Cliente[] = parseTable(rawClientes, (_row, get) => ({
    id: cleanId(get(['id'], 0)),
    nombre: text(get(['nombre', 'cliente', 'cliente_nombre'], 1)),
    tipo: normalizeTipo(get(['tipo', 'localidad'], 2)),
    declarante: toBool(get(['declarante', 'declarante_co'], 3)),
    activo: toBool(get(['activo', 'estado'], 4), true),
    fecha_creacion: toDateString(get(['fecha_creacion', 'fecha', 'created_at'], 5)),
    notas: text(get(['notas', 'nota'], 6)),
    marca_info: text(get(['marca_info', 'marca'], 7)),
    objetivos: text(get(['objetivos'], 8)),
    kpis: text(get(['kpis'], 9)),
    entregables: text(get(['entregables'], 10)),
    progreso: toNumber(get(['progreso'], 11)) || 0,
    responsable: text(get(['responsable'], 12)),
  }));

  // 3. Servicios mapping
  const servicios: Servicio[] = parseTable(rawServicios, (_row, get) => ({
    id: cleanId(get(['id', 'servicio_id'], 0)),
    nombre: text(get(['nombre', 'servicio', 'servicio_nombre'], 1)),
    costo_unitario: toNumber(get(['costo_unitario', 'costo', 'coste'], 2)) || 0,
    descripcion: text(get(['descripcion', 'descripción', 'notas'], 3)),
  }));

  // 4. Herramientas mapping
  const herramientas: Herramienta[] = parseTable(rawHerramientas, (_row, get) => ({
    id: cleanId(get(['id'], 0)),
    nombre: text(get(['nombre', 'herramienta'], 1)),
    monto: toNumber(get(['monto', 'valor', 'precio'], 2)) || 0,
    moneda: normalizeMoneda(get(['moneda'], 3)),
    tipo_cobro: normalizeTipoCobro(get(['tipo_cobro', 'tipo cobro'], 4)),
    servicios_ids: text(get(['servicios_ids', 'servicios', 'servicio_ids'], 5)),
    notas: text(get(['notas'], 6)),
  }));

  // 5. Otros Gastos mapping
  const otrosGastos: OtroGasto[] = parseTable(rawOtrosGastos, (_row, get) => ({
    id: cleanId(get(['id'], 0)),
    nombre: text(get(['nombre', 'concepto'], 1)),
    monto: toNumber(get(['monto', 'valor'], 2)) || 0,
    moneda: normalizeMoneda(get(['moneda'], 3)),
    categoria: normalizeOtroGastoCategoria(get(['categoria', 'categoría'], 4)),
    comprobante_url: text(get(['comprobante_url', 'comprobante'], 5)) || undefined,
    comprobante_nombre: text(get(['comprobante_nombre'], 6)) || undefined,
  }));

  // 6. Ventas mapping
  const ventas: Venta[] = parseTable(rawVentas, (_row, get) => {
    let parsedAbonos = [];
    const notasRaw = text(get(['notas', 'nota'], 13));
    const abonosRaw = text(get(['abonos_log', 'abonos', 'pagos', 'abonos log'], 14));
    const effectiveAbonos = abonosRaw || (looksLikeJsonArray(notasRaw) ? notasRaw : '');
    try {
      if (effectiveAbonos) {
        parsedAbonos = JSON.parse(effectiveAbonos);
      }
    } catch (e) {
      console.warn('Error parseando abonos_log', e);
    }
    return {
      id: cleanId(get(['id', 'ref_id'], 0)),
      fecha: toDateString(get(['fecha'], 1)),
      cliente_id: cleanId(get(['cliente_id', 'cliente id'], 2)),
      cliente_nombre: text(get(['cliente_nombre', 'cliente'], 3)),
      servicio_id: cleanId(get(['servicio_id', 'servicio id'], 4)),
      servicio_nombre: text(get(['servicio_nombre', 'servicio'], 5)),
      cantidad: toNumber(get(['cantidad'], 6)) || 1,
      precio_venta_unitario: toNumber(get(['precio_venta_unitario', 'precio unitario', 'precio', 'valor'], 7)) || 0,
      costo_unitario: toNumber(get(['costo_unitario', 'costo'], 8)) || 0,
      moneda: normalizeMoneda(get(['moneda'], 9)),
      tipo: normalizeTipo(get(['tipo'], 10)),
      adelanto: toNumber(get(['adelanto', 'abono'], 11)) || 0,
      estado_pago: normalizeEstadoPago(get(['estado_pago', 'estado cobro', 'estado'], 12)),
      notas: looksLikeJsonArray(notasRaw) ? '' : notasRaw,
      abonos: parsedAbonos,
    };
  });

  // 7. Horas mapping
  const horas: Hora[] = parseTable(rawHoras, (_row, get) => ({
    id: cleanId(get(['id', 'codigo', 'código'], 0)),
    fecha: toDateString(get(['fecha'], 1)),
    cliente_id: cleanId(get(['cliente_id', 'cliente id'], 2)),
    cliente_nombre: text(get(['cliente_nombre', 'cliente'], 3)),
    servicio_id: cleanId(get(['servicio_id', 'servicio id'], 4)),
    servicio_nombre: text(get(['servicio_nombre', 'servicio'], 5)),
    horas: toNumber(get(['horas', 'horas_logged'], 6)) || 0,
    descripcion: text(get(['descripcion', 'descripción', 'actividad'], 7)),
  }));

  // 8. Respaldos mapping
  const respaldos: Respaldo[] = parseTable(rawRespaldos, (_row, get) => ({
    fecha: toDateString(get(['fecha'], 0)),
    usuario: text(get(['usuario'], 1)),
    snapshot_drive_id: text(get(['snapshot_drive_id', 'snapshot'], 2)),
  }));

  // 9. PagosEgresos mapping
  const pagosEgresos: PagoEgreso[] = parseTable(rawPagosEgresos, (_row, get) => ({
    id: cleanId(get(['id'], 0)),
    fecha: toDateString(get(['fecha'], 1)),
    concepto: text(get(['concepto', 'nombre'], 2)),
    categoria: normalizePagoCategoria(get(['categoria', 'categoría'], 3)),
    monto: toNumber(get(['monto', 'valor'], 4)) || 0,
    moneda: normalizeMoneda(get(['moneda'], 5)),
    metodo_pago: text(get(['metodo_pago', 'método_pago', 'metodo', 'método'], 6)),
    notas: text(get(['notas'], 7)),
    comprobante_url: text(get(['comprobante_url', 'comprobante'], 8)) || undefined,
    comprobante_nombre: text(get(['comprobante_nombre'], 9)) || undefined,
  }));

  return {
    config,
    clientes,
    servicios,
    herramientas,
    otrosGastos,
    ventas,
    horas,
    respaldos,
    pagosEgresos,
  };
}

/**
 * Helper to dismiss headers row and map items
 */
function parseTable<T>(rawRows: any[][], mapper: (row: any[], get: (aliases: string[], fallbackIndex: number) => any) => T): T[] {
  if (rawRows.length <= 1) return [];
  const headers = (rawRows[0] || []).map(normalizeKey);
  const getFor = (row: any[]) => (aliases: string[], fallbackIndex: number) => {
    const index = aliases
      .map(normalizeKey)
      .map((alias) => headers.indexOf(alias))
      .find((idx) => idx >= 0);
    return row[index ?? fallbackIndex];
  };
  // Skip row 0 (headers) and filter out empty rows
  return rawRows
    .slice(1)
    .filter(row => row && row.length > 0 && row[0] !== undefined && String(row[0]).trim() !== '')
    .map((row) => mapper(row, getFor(row)));
}

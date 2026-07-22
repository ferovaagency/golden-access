/**
 * Plantillas CSV descargables + parseo para subida masiva de Clientes y
 * Servicios. Formato simple (comillas solo si el campo trae comas) para que
 * se pueda editar directo en Excel/Sheets sin depender de una librería.
 */
import type { Cliente, Servicio } from '../types';

export interface CsvPagoImportado {
  fila: number;
  fecha: string;
  monto: number;
  moneda: 'COP' | 'USD';
  cliente: string;
  servicio?: string;
  referencia?: string;
  notas?: string;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM: tildes correctas en Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function parseCsv(text: string, separator = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const clean = text.replace(/^﻿/, '');
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (inQuotes) {
      if (char === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') inQuotes = false;
      else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === separator) { row.push(field); field = ''; }
    else if (char === '\r') { /* skip, \n handles the break */ }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function parseMonto(value: string): number | null {
  const clean = value.trim().replace(/[^0-9,.-]/g, '');
  if (!clean) return null;
  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  let numeric = clean;
  if (lastComma >= 0 && lastDot >= 0) {
    numeric = lastComma > lastDot ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/,/g, '');
  } else if (lastComma >= 0) {
    numeric = /,\d{1,2}$/.test(clean) ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/,/g, '');
  } else if ((clean.match(/\./g) || []).length > 1) {
    numeric = clean.replace(/\./g, '');
  }
  const result = Number(numeric);
  return Number.isFinite(result) && result > 0 ? result : null;
}

function parseFecha(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const latin = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (!latin) return null;
  const year = latin[3].length === 2 ? `20${latin[3]}` : latin[3];
  return `${year}-${latin[2].padStart(2, '0')}-${latin[1].padStart(2, '0')}`;
}

/**
 * Lee extractos de cobros de distintas fuentes. Reconoce encabezados habituales
 * y deja que la pantalla decida qué filas se pueden asociar de forma segura.
 */
export function parsePagosCsv(text: string): { pagos: CsvPagoImportado[]; avisos: string[] } {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  const rows = parseCsv(text, (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',');
  if (rows.length < 2) throw new Error('El archivo no tiene filas de datos para importar.');
  const headers = rows[0].map(normalizedHeader);
  const column = (...aliases: string[]) => headers.findIndex((header) => aliases.includes(header));
  const fechaIdx = column('fecha', 'date', 'fechapago', 'paymentdate', 'createdat', 'fechaoperacion');
  const montoIdx = column('monto', 'amount', 'valor', 'importe', 'total', 'paymentamount', 'neto', 'gross');
  const clienteIdx = column('cliente', 'customer', 'client', 'nombrecliente', 'payer', 'pagador', 'emailcliente');
  const servicioIdx = column('servicio', 'service', 'producto', 'product', 'concepto', 'description', 'descripcion');
  const referenciaIdx = column('referencia', 'reference', 'transactionid', 'transaction', 'idtransaccion', 'paymentid', 'idpago', 'comprobante');
  const monedaIdx = column('moneda', 'currency', 'divisa');
  const notasIdx = column('notas', 'notes', 'detalle', 'memo', 'comentarios');
  if (montoIdx < 0) throw new Error('No encontré una columna de monto. Prueba con: monto, valor, importe, amount o total.');

  const avisos: string[] = [];
  if (clienteIdx < 0) avisos.push('No se encontró columna de cliente; las filas necesitarán revisión antes de asociarse.');
  const pagos: CsvPagoImportado[] = [];
  rows.slice(1).forEach((row, index) => {
    const monto = parseMonto(row[montoIdx] || '');
    const fecha = fechaIdx >= 0 ? parseFecha(row[fechaIdx] || '') : null;
    if (!monto) { avisos.push(`Fila ${index + 2}: monto inválido; se omitió.`); return; }
    pagos.push({
      fila: index + 2,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      monto,
      moneda: (monedaIdx >= 0 && (row[monedaIdx] || '').trim().toUpperCase() === 'USD') ? 'USD' : 'COP',
      cliente: clienteIdx >= 0 ? (row[clienteIdx] || '').trim() : '',
      servicio: servicioIdx >= 0 ? (row[servicioIdx] || '').trim() || undefined : undefined,
      referencia: referenciaIdx >= 0 ? (row[referenciaIdx] || '').trim() || undefined : undefined,
      notas: notasIdx >= 0 ? (row[notasIdx] || '').trim() || undefined : undefined,
    });
  });
  return { pagos, avisos };
}

const CLIENTES_HEADERS = ['id', 'nombre', 'tipo', 'declarante', 'activo', 'notas'];

export function downloadClientesTemplate() {
  downloadCsv('ferova_plantilla_clientes.csv', [
    CLIENTES_HEADERS,
    ['', 'Cliente de ejemplo S.A.S.', 'Nacional', 'TRUE', 'TRUE', 'Opcional'],
  ]);
}

/** Combina lo parseado con la lista actual: mismo id = actualiza, id vacío/nuevo = crea. */
export function parseClientesCsv(text: string, existing: Cliente[]): Cliente[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('El CSV no tiene filas de datos (solo encabezado o vacío).');
  const headerIdx = Object.fromEntries(rows[0].map((h, i) => [h.trim().toLowerCase(), i]));
  const required = ['nombre'];
  for (const key of required) if (!(key in headerIdx)) throw new Error(`Falta la columna "${key}" en el CSV.`);

  const byId = new Map(existing.map((c) => [c.id, c]));
  let seq = existing.length;
  for (const row of rows.slice(1)) {
    const get = (key: string) => (headerIdx[key] !== undefined ? (row[headerIdx[key]] || '').trim() : '');
    const nombre = get('nombre');
    if (!nombre) continue;
    const id = get('id') || `cli_${Date.now().toString().slice(-6)}_${++seq}`;
    const existingRow = byId.get(id);
    byId.set(id, {
      id,
      nombre,
      tipo: (get('tipo').toLowerCase().startsWith('inter') ? 'Internacional' : 'Nacional'),
      declarante: get('declarante') ? /^(true|si|sí|1)$/i.test(get('declarante')) : existingRow?.declarante ?? true,
      activo: get('activo') ? /^(true|si|sí|1)$/i.test(get('activo')) : existingRow?.activo ?? true,
      fecha_creacion: existingRow?.fecha_creacion || new Date().toISOString().slice(0, 10),
      notas: get('notas') || existingRow?.notas,
    });
  }
  return Array.from(byId.values());
}

const SERVICIOS_HEADERS = ['id', 'nombre', 'costo_unitario', 'margen_objetivo_pct', 'precio_habitual', 'precio_habitual_moneda'];

export function downloadServiciosTemplate() {
  downloadCsv('ferova_plantilla_servicios.csv', [
    SERVICIOS_HEADERS,
    ['', 'Servicio de ejemplo', '300000', '35', '950000', 'COP'],
  ]);
}

export function parseServiciosCsv(text: string, existing: Servicio[]): Servicio[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('El CSV no tiene filas de datos (solo encabezado o vacío).');
  const headerIdx = Object.fromEntries(rows[0].map((h, i) => [h.trim().toLowerCase(), i]));
  const required = ['nombre', 'costo_unitario'];
  for (const key of required) if (!(key in headerIdx)) throw new Error(`Falta la columna "${key}" en el CSV.`);

  const byId = new Map(existing.map((s) => [s.id, s]));
  let seq = existing.length;
  for (const row of rows.slice(1)) {
    const get = (key: string) => (headerIdx[key] !== undefined ? (row[headerIdx[key]] || '').trim() : '');
    const nombre = get('nombre');
    const costo = Number(get('costo_unitario'));
    if (!nombre || !Number.isFinite(costo)) continue;
    const id = get('id') || `srv_${Date.now().toString().slice(-6)}_${++seq}`;
    const existingRow = byId.get(id);
    const margenPct = get('margen_objetivo_pct');
    const precioHabitual = get('precio_habitual');
    byId.set(id, {
      id,
      nombre,
      costo_unitario: costo,
      descripcion: existingRow?.descripcion || `Línea de servicio general para ${nombre}`,
      margen_objetivo: margenPct ? Number(margenPct) / 100 : existingRow?.margen_objetivo ?? null,
      precio_habitual: precioHabitual ? Number(precioHabitual) : existingRow?.precio_habitual ?? null,
      precio_habitual_moneda: (get('precio_habitual_moneda').toUpperCase() === 'USD' ? 'USD' : 'COP'),
    });
  }
  return Array.from(byId.values());
}

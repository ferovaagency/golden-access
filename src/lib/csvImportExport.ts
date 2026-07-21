/**
 * Plantillas CSV descargables + parseo para subida masiva de Clientes y
 * Servicios. Formato simple (comillas solo si el campo trae comas) para que
 * se pueda editar directo en Excel/Sheets sin depender de una librería.
 */
import type { Cliente, Servicio } from '../types';

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

function parseCsv(text: string): string[][] {
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
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\r') { /* skip, \n handles the break */ }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
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

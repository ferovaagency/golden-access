import type { PlannerDraft } from './plannerService';

// Importación de tareas desde exports de Notion (CSV, HTML o Markdown) o texto
// pegado. Para CSV/HTML con columnas, construimos los borradores DIRECTO (título,
// fecha de vencimiento y cliente exactos), sin depender de que la IA los adivine.
// Para listas/markdown/texto plano, devolvemos líneas para el clasificador de IA.

export interface ClientOption { id: string; nombre: string }

const MESES: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const DONE_STATES = ['listo', 'hecho', 'done', 'complet', 'terminad', 'cancelad', 'descartad', 'archivad', 'finaliz'];
const STATUS_WORDS = [...DONE_STATES, 'sin empezar', 'en curso', 'en revis', 'progreso', 'pendiente', 'nuevo', 'to do', 'todo', 'doing', 'backlog', 'bloquead'];
const DUE_HINTS = ['vence', 'due', 'límite', 'limite', 'plazo', 'entrega', 'deadline', 'fecha'];
const CREATED_HINTS = ['cre', 'hora', 'modif', 'edit', 'actualiz', 'last'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toIsoDate(value: string): string | null {
  const s = (value || '').trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/);
  if (m && MESES[m[2]]) return `${m[3]}-${pad(MESES[m[2]])}-${pad(Number(m[1]))}`;
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  return null;
}

const looksDate = (v: string) => /\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/i.test(v);
const hasTime = (v: string) => /\d{1,2}:\d{2}/.test(v);

function normalize(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Parser CSV que respeta comillas (comas y saltos de línea dentro de "..."). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Empareja un nombre del CSV con un cliente real (exacto, por contención o por
 *  solapamiento de palabras ≥ 0.6). Devuelve el cliente o null (para no mapear mal). */
export function matchClient(name: string, clients: ClientOption[]): ClientOption | null {
  const n = normalize(name).replace(/\(https?:[^)]*\)/g, '').trim();
  if (!n || !clients.length) return null;
  const exact = clients.find((c) => normalize(c.nombre) === n);
  if (exact) return exact;
  const contained = clients.find((c) => { const cn = normalize(c.nombre); return cn.includes(n) || n.includes(cn); });
  if (contained) return contained;
  const nt = new Set(n.split(' ').filter((w) => w.length > 2));
  if (!nt.size) return null;
  let best: ClientOption | null = null;
  let bestScore = 0;
  for (const c of clients) {
    const ct = new Set(normalize(c.nombre).split(' ').filter((w) => w.length > 2));
    const inter = [...nt].filter((w) => ct.has(w)).length;
    const score = inter / Math.max(1, Math.min(nt.size, ct.size));
    if (inter >= 2 && score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= 0.6 ? best : null;
}

function columnCount(rows: string[][]): number {
  return Math.max(...rows.map((r) => r.length));
}

/** Columna de fecha de VENCIMIENTO: la que trae fechas y, sobre todo, sin hora
 *  (las de creación/edición traen hora). Usa el encabezado como desempate. */
function pickDateColumn(rows: string[][]): number | null {
  const header = (rows[0] || []).map((h) => normalize(h));
  const data = rows.slice(1);
  const ncols = columnCount(rows);
  let best = -1, bestScore = -Infinity;
  for (let c = 0; c < ncols; c++) {
    let dates = 0, times = 0, nonEmpty = 0;
    for (const r of data) { const v = (r[c] || '').trim(); if (!v) continue; nonEmpty++; if (looksDate(v)) dates++; if (hasTime(v)) times++; }
    if (nonEmpty < 1 || dates < nonEmpty * 0.5) continue;
    let score = dates - times * 3;
    const h = header[c] || '';
    if (DUE_HINTS.some((k) => h.includes(k))) score += 3;
    if (CREATED_HINTS.some((k) => h.includes(k))) score -= 6;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best >= 0 && bestScore > -3 ? best : null;
}

/** Columna de cliente: la que más valores empareja (fuzzy) con clientes reales. */
function pickClientColumn(rows: string[][], clients: ClientOption[]): number | null {
  if (!clients.length) return null;
  const data = rows.slice(1);
  const ncols = columnCount(rows);
  let best = -1, bestHits = 0;
  for (let c = 0; c < ncols; c++) {
    let hits = 0;
    for (const r of data) { const v = (r[c] || '').trim(); if (v && matchClient(v, clients)) hits++; }
    if (hits > bestHits) { bestHits = hits; best = c; }
  }
  return bestHits >= 1 ? best : null;
}

/** Columna de estado: la que más valores coincide con estados típicos. */
function pickStatusColumn(rows: string[][]): number | null {
  const data = rows.slice(1);
  const ncols = columnCount(rows);
  let best = -1, bestHits = 0;
  for (let c = 0; c < ncols; c++) {
    let hits = 0;
    for (const r of data) { const v = normalize(r[c] || ''); if (v && STATUS_WORDS.some((s) => v.includes(s))) hits++; }
    if (hits > bestHits) { bestHits = hits; best = c; }
  }
  return best >= 0 && bestHits >= Math.max(2, data.length * 0.3) ? best : null;
}

function draftDefaults(): Omit<PlannerDraft, 'line' | 'title' | 'detected_deadline' | 'detected_client' | 'client_ref'> {
  return {
    detected_type: 'task',
    detected_priority: 'medium',
    detected_energy: 'medium',
    detected_category: 'admin',
    detected_duration_min: 30,
    financial_impact: 3,
    client_impact: 3,
    risk_score: 3,
    execution_ease: 3,
    detected_project: null,
    scheduled_for: null,
    reasoning: 'Importado de Notion',
    confidence: 1,
  };
}

/** Construye borradores directamente de filas con columnas (CSV o tabla HTML). */
function buildDraftsFromRows(rows: string[][], clients: ClientOption[]): { drafts: PlannerDraft[]; omitidas: number } {
  if (rows.length < 2) return { drafts: [], omitidas: 0 };
  const iDate = pickDateColumn(rows);
  const iClient = pickClientColumn(rows, clients);
  const iStatus = pickStatusColumn(rows);
  const iTitle = 0; // Notion siempre exporta el nombre/título en la primera columna.

  const drafts: PlannerDraft[] = [];
  let omitidas = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const title = (row[iTitle] || '').trim().replace(/\s+/g, ' ');
    if (!title || /^https?:\/\//i.test(title)) continue;
    if (iStatus != null) {
      const st = normalize(row[iStatus] || '');
      if (st && DONE_STATES.some((d) => st.includes(d))) { omitidas++; continue; }
    }
    const client = iClient != null ? matchClient(row[iClient] || '', clients) : null;
    const deadline = iDate != null ? toIsoDate(row[iDate] || '') : null;
    drafts.push({
      ...draftDefaults(),
      line: title,
      title: title.slice(0, 300),
      detected_deadline: deadline,
      detected_client: client?.nombre ?? null,
      client_ref: client?.id ?? null,
    });
    if (drafts.length >= 200) break;
  }
  return { drafts, omitidas };
}

function cleanListLine(line: string): string {
  let l = line.trim();
  if (!l) return '';
  if (/^\|?[\s:|-]+$/.test(l) && /-/.test(l)) return '';
  if (l.startsWith('|')) l = l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim()).filter(Boolean).join(' — ');
  l = l.replace(/^[-*+]\s+/, '').replace(/^\[[ xX]\]\s+/, '').replace(/^\d+[.)]\s+/, '');
  return l.trim();
}

export interface ImportResult {
  /** Borradores listos (CSV/tabla): se muestran directo, sin IA. */
  drafts?: PlannerDraft[];
  /** Líneas para el clasificador de IA (listas/texto sin columnas). */
  lines?: string[];
  omitidas: number;
}

/** Punto de entrada: decide entre construir borradores (CSV/tabla) o líneas (IA). */
export function importFromContent(raw: string, clients: ClientOption[], opts: { html?: boolean; csv?: boolean } = {}): ImportResult {
  const looksHtml = opts.html || /<table|<\/tr>|<!doctype html|<html/i.test(raw);
  if (looksHtml && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    const table = doc.querySelector('table');
    if (table) {
      const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.querySelectorAll('td,th')).map((c) => (c.textContent || '').trim()));
      return buildDraftsFromRows(rows, clients);
    }
    return importFromContent(doc.body?.textContent || raw, clients, {});
  }

  const firstLine = raw.split(/\r?\n/).find((l) => l.trim()) || '';
  const looksCsv = opts.csv || (firstLine.split(',').length >= 3 && !firstLine.includes('|'));
  if (looksCsv) {
    const rows = parseCsv(raw);
    if (rows.length >= 2) return buildDraftsFromRows(rows, clients);
  }

  // Lista / markdown / texto plano -> líneas para la IA.
  const lines = raw.split(/\r?\n/).map(cleanListLine).filter(Boolean).slice(0, 120);
  return { lines, omitidas: 0 };
}

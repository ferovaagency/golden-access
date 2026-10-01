// Intérprete determinista de capturas del Planner. Sin dependencias: lo usan
// la edge function `planner-classify` (como respaldo cuando la IA no responde
// y para resolver clientes) y las pruebas en tests/taskParser.test.ts.
//
// Modelo de interpretación (documentado en Notion · Bandeja de conocimiento IA):
//   - Una línea puede traer VARIAS tareas: "El Rocket: reporte mensual, revisar
//     GA4 para mañana" son dos tareas de El Rocket para mañana.
//   - Lo que va antes de ":" o ";" al inicio de la línea es el CLIENTE de toda
//     la línea.
//   - Una fecha al final de la línea ("para mañana", "el viernes", "antes del
//     15/10") aplica a todas las tareas de esa línea que no tengan la suya.
//   - Los clientes se resuelven con tolerancia a errores de tecleo
//     ("roecket" → El Rocket). Si no hay coincidencia clara, queda sin cliente:
//     mejor preguntar que adivinar mal.

export interface ParsedTask {
  title: string;
  client_text: string | null;
  deadline: string | null;
  /** La línea original de la que salió. */
  line: string;
}

export interface ClientLike { id: string; nombre: string }

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

export function normalizeText(value: string): string {
  return (value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Como normalizeText pero conserva "/" y "-" para reconocer fechas como 15/10 o 2026-10-15. */
function normalizeDates(value: string): string {
  return (value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 /-]/g, ' ').replace(/\s+/g, ' ').trim();
}

const pad = (n: number) => String(n).padStart(2, '0');

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/**
 * Convierte una expresión de fecha en español a YYYY-MM-DD relativa a `today`.
 * Devuelve null si no la entiende. "el viernes" = el próximo viernes (si hoy es
 * viernes, el de la semana que viene: nadie escribe "el viernes" por hoy).
 */
export function parseSpanishDate(raw: string, today: string): string | null {
  const s = normalizeDates(raw);
  if (!s) return null;
  if (/\bpasado manana\b/.test(s)) return shiftDate(today, 2);
  if (/\bmanana\b/.test(s)) return shiftDate(today, 1);
  if (/\bhoy\b/.test(s)) return today;
  if (/\bfin de semana\b/.test(s)) { const dow = weekdayOf(today); return shiftDate(today, ((6 - dow) + 7) % 7 || 7); }
  let m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/\b(\d{1,2})\s*[\/-]\s*(\d{1,2})(?:\s*[\/-]\s*(\d{2,4}))?\b/);
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today.slice(0, 4));
    const candidate = `${year}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
    // Sin año: si ya pasó, es del año que viene.
    return !m[3] && candidate < today ? `${year + 1}-${pad(Number(m[2]))}-${pad(Number(m[1]))}` : candidate;
  }
  m = s.match(/\b(\d{1,2})\s+de\s+([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?\b/);
  if (m && MESES[m[2]]) {
    const year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
    const candidate = `${year}-${pad(MESES[m[2]])}-${pad(Number(m[1]))}`;
    return !m[3] && candidate < today ? `${year + 1}-${pad(MESES[m[2]])}-${pad(Number(m[1]))}` : candidate;
  }
  for (let i = 0; i < DIAS.length; i++) {
    if (new RegExp(`\\b${DIAS[i]}\\b`).test(s)) {
      const dow = weekdayOf(today);
      let delta = (i - dow + 7) % 7;
      if (delta === 0) delta = 7;
      if (/\bproxim[oa]\b/.test(s) && delta < 7) {
        // "el próximo viernes" dicho un miércoles suele ser el de esta semana
        // en Colombia; se deja el más cercano. Sólo "la otra semana" salta.
      }
      if (/\b(otra|siguiente) semana\b/.test(s)) delta += 7;
      return shiftDate(today, delta);
    }
  }
  if (/\b(la )?(otra|proxima|siguiente) semana\b/.test(s)) return shiftDate(today, 7 - weekdayOf(today) + 1);
  return null;
}

/** Fecha al final de un fragmento ("... para mañana", "... el viernes", "... antes del 15/10"). */
const TRAILING_DATE = /\s*(?:[,;]\s*)?\b(?:para|antes del?|antes de|hasta el|hasta|el|la|este|esta|entrega(?:r)?(?: el)?|vence(?: el)?)\s+((?:pasado\s+)?manana|hoy|fin de semana|(?:el\s+)?(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)(?:\s+de\s+la\s+(?:otra|proxima|siguiente)\s+semana)?|(?:la\s+)?(?:otra|proxima|siguiente)\s+semana|\d{1,2}\s*[\/-]\s*\d{1,2}(?:\s*[\/-]\s*\d{2,4})?|\d{1,2}\s+de\s+[a-z]+(?:\s+(?:de\s+)?\d{4})?|\d{4}-\d{2}-\d{2})\s*$/;

function splitTrailingDate(fragment: string, today: string): { text: string; deadline: string | null } {
  const normalized = normalizeDates(fragment);
  const m = normalized.match(TRAILING_DATE);
  if (!m) return { text: fragment.trim(), deadline: null };
  const deadline = parseSpanishDate(m[1], today);
  if (!deadline) return { text: fragment.trim(), deadline: null };
  // Quitar la expresión de fecha del texto original (no del normalizado), por
  // longitud: la cola normalizada y la original tienen las mismas palabras.
  const words = normalized.slice(m.index).trim().split(' ').length;
  const original = fragment.trim().split(/\s+/);
  const text = original.slice(0, Math.max(1, original.length - words)).join(' ').replace(/[,;]\s*$/, '').trim();
  return { text: text || fragment.trim(), deadline };
}

/** Separa "a, b y c" / "a; b" en tareas. No parte por "y" si no hay comas y el texto es corto. */
function splitTasks(text: string): string[] {
  const byPunct = text.split(/\s*[;,]\s*|\s+\.\s+/).map((t) => t.trim()).filter(Boolean);
  const out: string[] = [];
  for (const part of byPunct) {
    // " y " separa sólo cuando ambos lados parecen tareas (verbo + objeto, ≥ 2 palabras).
    const yParts = part.split(/\s+y\s+/);
    if (yParts.length > 1 && yParts.every((p) => p.trim().split(' ').length >= 2)) out.push(...yParts.map((p) => p.trim()));
    else out.push(part);
  }
  return out.filter((t) => t.length > 1);
}

/** Prefijo "Cliente:" o "Cliente;" al inicio de la línea. */
function splitClientPrefix(line: string): { client: string | null; rest: string } {
  const m = line.match(/^\s*([^:;]{2,40}?)\s*[:;]\s*(.+)$/);
  if (!m) return { client: null, rest: line.trim() };
  const client = m[1].trim();
  // "https:" o una hora "10:30" no son clientes.
  if (/^https?$/i.test(client) || /^\d{1,2}$/.test(client)) return { client: null, rest: line.trim() };
  return { client, rest: m[2].trim() };
}

function cleanListLine(line: string): string {
  return line.replace(/^[-*+•]\s+/, '').replace(/^\[[ xX]\]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();
}

/**
 * Texto libre → tareas con cliente y fecha heredados por línea.
 * `today` en la zona horaria de la persona (YYYY-MM-DD).
 */
export function parseCapture(raw: string, today: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = cleanListLine(rawLine);
    if (!line) continue;
    const { client, rest } = splitClientPrefix(line);
    const { text: body, deadline: lineDeadline } = splitTrailingDate(rest, today);
    for (const piece of splitTasks(body)) {
      const { text, deadline } = splitTrailingDate(piece, today);
      const title = text.replace(/^(y|e)\s+/i, '').trim();
      if (!title) continue;
      tasks.push({ title: title.charAt(0).toUpperCase() + title.slice(1), client_text: client, deadline: deadline || lineDeadline, line });
    }
  }
  return tasks;
}

// --- Clientes con tolerancia a errores de tecleo ---

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = i - 1; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = temp;
    }
  }
  return prev[b.length];
}

const STOP = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'the', 'and', 'y', 'para', 'con', 'en']);

function significantWords(value: string): string[] {
  return normalizeText(value).split(' ').filter((w) => w.length > 1 && !STOP.has(w));
}

/**
 * Empareja un nombre escrito a mano con un cliente real. Exacto → contenido →
 * palabras significativas con hasta 2 letras de diferencia. Devuelve null si
 * hay empate o ninguna coincidencia clara.
 */
export function matchClientName<T extends ClientLike>(name: string | null | undefined, clients: T[]): T | null {
  if (!name || !clients.length) return null;
  const n = normalizeText(name);
  if (!n) return null;
  const exact = clients.find((c) => normalizeText(c.nombre) === n);
  if (exact) return exact;
  const contained = clients.filter((c) => { const cn = normalizeText(c.nombre); return cn.length >= 3 && (cn.includes(n) || n.includes(cn)); });
  if (contained.length === 1) return contained[0];
  const words = significantWords(name);
  if (!words.length) return null;
  let best: T | null = null; let bestScore = 0; let tie = false;
  for (const client of clients) {
    const cw = significantWords(client.nombre);
    if (!cw.length) continue;
    let hits = 0;
    for (const w of words) {
      const tolerance = w.length >= 6 ? 2 : w.length >= 4 ? 1 : 0;
      if (cw.some((x) => x === w || (tolerance > 0 && Math.abs(x.length - w.length) <= tolerance && levenshtein(x, w) <= tolerance))) hits++;
    }
    const score = hits / Math.max(words.length, cw.length);
    if (score > bestScore) { bestScore = score; best = client; tie = false; }
    else if (score === bestScore && score > 0) tie = true;
  }
  return best && bestScore >= 0.5 && !tie ? best : null;
}

/** Día de hoy (YYYY-MM-DD) en una zona horaria IANA. */
export function todayInZone(timeZone: string, instant = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(instant).reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

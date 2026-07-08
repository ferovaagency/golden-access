// Importa datos financieros desde un Google Sheet público (o compartido con "cualquiera con el link puede ver").
// No requiere OAuth: usa el endpoint CSV de gviz. Devuelve values 2D por pestaña.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

const SHEET_TABS = ['Config', 'Clientes', 'Servicios', 'Herramientas', 'OtrosGastos', 'Ventas', 'Horas', 'Respaldos', 'PagosEgresos'];

const BodySchema = z.object({
  url: z.string().trim().min(10).max(500),
});

function extractSpreadsheetId(input: string): string | null {
  const m = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(input)) return input;
  return null;
}

// CSV parser minimal pero robusto (maneja comas y comillas dobles)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.length && !(r.length === 1 && r[0] === ''));
}

async function fetchTabCsv(spreadsheetId: string, tab: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    if (res.status === 404) return []; // pestaña no existe
    throw new Error(`No pude leer la pestaña "${tab}" (HTTP ${res.status}). Verifica que la hoja esté compartida como "Cualquier persona con el link puede ver".`);
  }
  const text = await res.text();
  // Google devuelve HTML de login en algunos casos de acceso denegado
  if (text.trimStart().startsWith('<')) {
    throw new Error(`La hoja no es públicamente accesible. Compártela con "Cualquier persona con el link puede ver" desde el botón "Compartir" en Google Sheets.`);
  }
  return parseCsv(text);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ ok: false, message: 'URL inválida', errors: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const spreadsheetId = extractSpreadsheetId(parsed.data.url);
    if (!spreadsheetId) {
      return new Response(JSON.stringify({ ok: false, message: 'No pude extraer el ID del link. Debe verse como https://docs.google.com/spreadsheets/d/XXXX/edit' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const values: Record<string, string[][]> = {};
    // Traer pestañas en paralelo para velocidad
    const results = await Promise.allSettled(SHEET_TABS.map(t => fetchTabCsv(spreadsheetId, t)));
    let successCount = 0;
    let firstError: string | null = null;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') { values[SHEET_TABS[i]] = r.value; if (r.value.length) successCount++; }
      else { values[SHEET_TABS[i]] = []; if (!firstError) firstError = (r.reason as Error)?.message || String(r.reason); }
    });

    if (successCount === 0) {
      return new Response(JSON.stringify({ ok: false, message: firstError || 'No se pudo leer ninguna pestaña. Verifica el link y los permisos.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, spreadsheetId, values, warnings: firstError }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[sheets-import] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

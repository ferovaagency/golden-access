// Importa datos financieros desde un Google Sheet público (o compartido con "cualquiera con el link puede ver").
// No requiere OAuth: usa el endpoint CSV de gviz. Devuelve values 2D por pestaña.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod';

const SHEET_TABS = ['Config', 'Clientes', 'Servicios', 'Herramientas', 'OtrosGastos', 'Ventas', 'Horas', 'Respaldos', 'PagosEgresos'];

const BodySchema = z.object({
  url: z.string().trim().min(10).max(500),
  access_token: z.string().trim().min(20).optional(),
});

const SHEET_RANGES = SHEET_TABS.map((tab) => `${tab}!A1:Z5000`);

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

async function fetchSheetsApi(spreadsheetId: string, accessToken: string): Promise<Record<string, string[][]>> {
  const query = SHEET_RANGES.map((range) => `ranges=${encodeURIComponent(range)}`).join('&');
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const details = await res.text();
    throw new Error(`No pude leer la hoja con tu cuenta Google (HTTP ${res.status}). ${details.slice(0, 300)}`);
  }
  const data = await res.json();
  const values: Record<string, string[][]> = {};
  for (const vr of data.valueRanges || []) {
    const sheetName = (vr.range || '').replace(/'/g, '').split('!')[0];
    values[sheetName] = vr.values || [];
  }
  return values;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // This endpoint can receive a short-lived Google access token. Do not make
  // it an unauthenticated proxy, even when the target sheet itself is public.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, message: 'Autenticacion requerida.' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ ok: false, message: 'Sesion no valida.' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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

    if (parsed.data.access_token) {
      const values = await fetchSheetsApi(spreadsheetId, parsed.data.access_token);
      const successCount = Object.values(values).filter((v) => v.length > 0).length;
      if (successCount === 0) {
        return new Response(JSON.stringify({ ok: false, message: 'La hoja se abrió con Google, pero no encontré datos en las pestañas esperadas.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true, spreadsheetId, values, mode: 'google_token' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    const unavailableTabs = results
      .map((result, index) => result.status === 'rejected' ? SHEET_TABS[index] : null)
      .filter((tab): tab is string => tab !== null);
    if (unavailableTabs.length) {
      return new Response(JSON.stringify({
        ok: false,
        message: `La hoja no tiene la estructura requerida. No pude leer: ${unavailableTabs.join(', ')}. Debe usar las pestañas exactas: ${SHEET_TABS.join(', ')}.`,
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

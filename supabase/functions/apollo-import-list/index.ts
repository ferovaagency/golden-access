// Importa una lista de prospectos desde Apollo.io (búsqueda con filtros) al
// pipeline de crm_oportunidades: pagina resultados, deduplica contra lo que
// ya existe en el pipeline (por email, LinkedIn o nombre+dominio) e inserta
// solo los prospectos nuevos como oportunidades en estado 'nuevo'.
//
// Deliberadamente NO genera el playbook de outreach aquí: eso ya existe como
// un flujo separado y probado (apollo-enrich-playbook), que el equipo dispara
// manualmente por oportunidad desde el pipeline. Encadenar N llamadas de IA
// dentro de una sola importación masiva sería lento y frágil (timeouts,
// gasto de créditos si algo falla a la mitad); mejor importar rápido y dejar
// que el enriquecimiento/playbook se haga contacto por contacto, ya con
// contexto humano de cuáles priorizar.
//
// Body:
// {
//   titles?: string[],       // cargos a buscar, ej. ["CEO", "Marketing Director"]
//   keywords?: string,       // búsqueda libre (q_keywords)
//   domains?: string[],      // dominios de empresa objetivo
//   locations?: string[],    // ciudades/países
//   max_results?: number     // default 25, tope 100 (protege créditos de Apollo)
// }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';
import { fetchWithRetry } from '../_shared/fetch-retry.ts';

const BodySchema = z.object({
  titles: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
  keywords: z.string().trim().max(200).optional(),
  domains: z.array(z.string().trim().min(1).max(255)).max(10).optional(),
  locations: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
  max_results: z.number().int().min(1).max(100).default(25),
});

const PER_PAGE = 25;
const MAX_PAGES = 8; // tope duro: 8 páginas x 25/página = 200 resultados máx por corrida, aunque max_results sea menor

function normalizeLinkedin(url?: string | null): string | null {
  if (!url) return null;
  try {
    const clean = url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    return clean || null;
  } catch { return null; }
}

function normalizeName(name?: string | null): string | null {
  if (!name) return null;
  const clean = name.trim().toLowerCase().replace(/\s+/g, ' ');
  return clean || null;
}

function domainOf(value?: string | null): string | null {
  if (!value) return null;
  try {
    if (value.includes('@')) return value.split('@')[1]?.trim().toLowerCase() || null;
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, message: 'No autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return new Response(JSON.stringify({ ok: false, message: 'Sesión inválida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: team } = await supabase.from('crm_team_members').select('email').eq('email', user.email).maybeSingle();
    if (!team) {
      return new Response(JSON.stringify({ ok: false, message: 'No autorizado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
    if (!APOLLO_API_KEY) {
      return new Response(JSON.stringify({ ok: false, message: 'Apollo todavía no está conectado. Configura APOLLO_API_KEY en los secretos de Supabase para habilitar la importación de listas.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsedBody = BodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ ok: false, message: 'Parámetros inválidos', errors: parsedBody.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { titles, keywords, domains, locations, max_results } = parsedBody.data;
    if (!titles?.length && !keywords && !domains?.length && !locations?.length) {
      return new Response(JSON.stringify({ ok: false, message: 'Define al menos un filtro (cargo, palabra clave, dominio o ubicación) para buscar en Apollo.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Búsqueda paginada en Apollo ----
    const found: any[] = [];
    let page = 1;
    let totalAvailable: number | null = null;
    while (found.length < max_results && page <= MAX_PAGES) {
      const searchBody: Record<string, unknown> = { page, per_page: PER_PAGE };
      if (titles?.length) searchBody.person_titles = titles;
      if (keywords) searchBody.q_keywords = keywords;
      if (domains?.length) searchBody.q_organization_domains_list = domains;
      if (locations?.length) searchBody.person_locations = locations;

      const res = await fetchWithRetry('https://api.apollo.io/api/v1/mixed_people/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': APOLLO_API_KEY },
        body: JSON.stringify(searchBody),
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`[apollo-import-list] search ${res.status}: ${text.slice(0, 300)}`);
        // Si ya encontramos algo en páginas previas, devolvemos lo que hay en vez de
        // perder resultados válidos por un fallo tardío (ej. rate limit en la página 3).
        if (found.length > 0) break;
        return new Response(JSON.stringify({ ok: false, message: 'Apollo no pudo completar la búsqueda.', status: res.status, details: text.slice(0, 500) }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      let json: any;
      try { json = JSON.parse(text); } catch {
        return new Response(JSON.stringify({ ok: false, message: 'Apollo devolvió una respuesta inválida.' }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const people: any[] = json?.people || [];
      totalAvailable = json?.pagination?.total_entries ?? totalAvailable;
      if (people.length === 0) break;
      found.push(...people);
      const totalPages = json?.pagination?.total_pages;
      page += 1;
      if (typeof totalPages === 'number' && page > totalPages) break;
    }

    const candidates = found.slice(0, max_results);

    // ---- Deduplicación contra el pipeline existente ----
    const { data: existingRows, error: existingErr } = await supabase
      .from('crm_oportunidades')
      .select('nombre_contacto, email, empresa, fuente_url, apollo_data');
    if (existingErr) throw existingErr;

    const existingEmails = new Set<string>();
    const existingLinkedin = new Set<string>();
    const existingNameDomain = new Set<string>();
    for (const row of existingRows || []) {
      if (row.email) existingEmails.add(row.email.trim().toLowerCase());
      const li = normalizeLinkedin(row.apollo_data?.person?.linkedin_url);
      if (li) existingLinkedin.add(li);
      const dom = domainOf(row.email) || domainOf(row.fuente_url) || domainOf(row.empresa);
      const nm = normalizeName(row.nombre_contacto);
      if (nm && dom) existingNameDomain.add(`${nm}|${dom}`);
    }

    const toInsert: any[] = [];
    let skippedDuplicates = 0;
    for (const person of candidates) {
      const email: string | null = person.email || person.contact_emails?.[0]?.email || null;
      const linkedin = normalizeLinkedin(person.linkedin_url);
      const domain = domainOf(person.organization?.primary_domain) || domainOf(person.organization?.website_url) || domainOf(email);
      const name = normalizeName(person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim());

      const isDuplicate =
        (email && existingEmails.has(email.trim().toLowerCase())) ||
        (linkedin && existingLinkedin.has(linkedin)) ||
        (name && domain && existingNameDomain.has(`${name}|${domain}`));

      if (isDuplicate) { skippedDuplicates += 1; continue; }

      // Registra la fila para no reimportar el mismo prospecto dos veces dentro de
      // esta misma corrida si Apollo lo repite entre páginas.
      if (email) existingEmails.add(email.trim().toLowerCase());
      if (linkedin) existingLinkedin.add(linkedin);
      if (name && domain) existingNameDomain.add(`${name}|${domain}`);

      const now = new Date().toISOString();
      toInsert.push({
        nombre_contacto: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'Sin nombre',
        empresa: person.organization?.name || null,
        canal_origen: 'apollo_import',
        estado: 'nuevo',
        email: email || null,
        telefono: person.phone_numbers?.[0]?.sanitized_number || null,
        fuente_url: person.linkedin_url || null,
        apollo_data: { requested_at: now, source: 'apollo_import_list', person },
        apollo_enriched_at: now,
        notas: [person.title, person.organization?.industry].filter(Boolean).join(' · ') || null,
      });
    }

    let inserted: any[] = [];
    if (toInsert.length > 0) {
      const { data, error } = await supabase.from('crm_oportunidades').insert(toInsert).select('*');
      if (error) throw error;
      inserted = data || [];
    }

    return new Response(JSON.stringify({
      ok: true,
      total_found: totalAvailable ?? candidates.length,
      fetched: candidates.length,
      imported: inserted.length,
      skipped_duplicates: skippedDuplicates,
      oportunidades: inserted,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[apollo-import-list] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

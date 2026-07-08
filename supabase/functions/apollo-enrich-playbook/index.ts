// Enriquece una oportunidad con Apollo.io (People + Organization Enrichment)
// y luego genera con Lovable AI un playbook de outreach (email, LinkedIn, WhatsApp).
// Todo se guarda en crm_oportunidades. Esta función NO envía nada por ningún canal.
//
// Body:
// {
//   oportunidad_id?: string,           // si viene, actualiza esa fila
//   nombre_contacto?: string,          // requerido si no hay oportunidad_id
//   empresa?: string,
//   dominio?: string,                  // ej. "acme.com"
//   linkedin_url?: string,
//   email?: string,
//   canal_origen?: 'linkedin'|'reddit'|'otro'|... (default 'otro'),
//   fuente_url?: string,
//   contexto_publicacion?: string      // texto original del post/comentario que originó el lead
// }
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Body {
  oportunidad_id?: string;
  nombre_contacto?: string;
  empresa?: string;
  dominio?: string;
  linkedin_url?: string;
  email?: string;
  canal_origen?: string;
  fuente_url?: string;
  contexto_publicacion?: string;
}

async function apolloPeopleMatch(apiKey: string, params: {
  first_name?: string; last_name?: string; name?: string;
  email?: string; linkedin_url?: string; organization_name?: string; domain?: string;
}) {
  const res = await fetch('https://api.apollo.io/api/v1/people/match?reveal_personal_emails=true&reveal_phone_number=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': apiKey },
    body: JSON.stringify(params),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[apollo-enrich] people/match ${res.status}: ${text.slice(0, 300)}`);
    return { ok: false, status: res.status, error: text.slice(0, 500) };
  }
  try { return { ok: true, data: JSON.parse(text) }; } catch { return { ok: false, error: 'JSON inválido' }; }
}

async function apolloOrgEnrich(apiKey: string, domain: string) {
  const url = new URL('https://api.apollo.io/api/v1/organizations/enrich');
  url.searchParams.set('domain', domain);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache', 'x-api-key': apiKey },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[apollo-enrich] org/enrich ${res.status}: ${text.slice(0, 300)}`);
    return { ok: false, status: res.status, error: text.slice(0, 500) };
  }
  try { return { ok: true, data: JSON.parse(text) }; } catch { return { ok: false, error: 'JSON inválido' }; }
}

function domainFromEmailOrUrl(email?: string, url?: string) {
  if (email && email.includes('@')) return email.split('@')[1].trim().toLowerCase();
  if (url) {
    try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, ''); } catch { /**/ }
  }
  return undefined;
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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!APOLLO_API_KEY) {
      return new Response(JSON.stringify({ ok: false, message: 'APOLLO_API_KEY no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ ok: false, message: 'LOVABLE_API_KEY no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;

    // Cargar oportunidad si viene el id
    let oportunidad: any = null;
    if (body.oportunidad_id) {
      const { data, error } = await supabase.from('crm_oportunidades').select('*').eq('id', body.oportunidad_id).maybeSingle();
      if (error) throw error;
      oportunidad = data;
    }

    const nombre_contacto = (oportunidad?.nombre_contacto || body.nombre_contacto || '').trim();
    if (!nombre_contacto) {
      return new Response(JSON.stringify({ ok: false, message: 'nombre_contacto es requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const empresa = (oportunidad?.empresa || body.empresa || '').trim() || undefined;
    const linkedin_url = (body.linkedin_url || '').trim() || undefined;
    const emailIn = (body.email || oportunidad?.email || '').trim() || undefined;
    const fuente_url = (body.fuente_url || oportunidad?.fuente_url || '').trim() || undefined;
    const canal_origen = (body.canal_origen || oportunidad?.canal_origen || 'otro') as string;
    const contexto = (body.contexto_publicacion || '').trim();

    let dominio = (body.dominio || '').trim().toLowerCase() || undefined;
    if (!dominio) dominio = domainFromEmailOrUrl(emailIn, fuente_url);

    // Split nombre
    const parts = nombre_contacto.split(/\s+/);
    const first_name = parts[0];
    const last_name = parts.slice(1).join(' ') || undefined;

    // ---- Apollo ----
    const peopleParams: any = { first_name, last_name, name: nombre_contacto };
    if (emailIn) peopleParams.email = emailIn;
    if (linkedin_url) peopleParams.linkedin_url = linkedin_url;
    if (empresa) peopleParams.organization_name = empresa;
    if (dominio) peopleParams.domain = dominio;

    const person = await apolloPeopleMatch(APOLLO_API_KEY, peopleParams);
    let org: any = null;
    const orgDomain = person.ok
      ? (person.data?.person?.organization?.primary_domain || person.data?.person?.organization?.website_url || dominio)
      : dominio;
    let orgDomainClean: string | undefined;
    if (orgDomain) {
      try { orgDomainClean = orgDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]; } catch { /**/ }
    }
    if (orgDomainClean) {
      org = await apolloOrgEnrich(APOLLO_API_KEY, orgDomainClean);
    }

    const apollo_data = {
      requested_at: new Date().toISOString(),
      inputs: { nombre_contacto, empresa, dominio, linkedin_url, email: emailIn },
      person: person.ok ? person.data?.person || person.data : { error: person.error, status: (person as any).status },
      organization: org?.ok ? org.data?.organization || org.data : (org ? { error: org.error, status: (org as any).status } : null),
    };

    // Extraer datos útiles
    const p = person.ok ? (person.data?.person || {}) : {};
    const o = org?.ok ? (org.data?.organization || {}) : {};
    const foundEmail: string | undefined = p.email || (p.contact_emails?.[0]?.email) || emailIn;
    const foundPhone: string | undefined = p.phone_numbers?.[0]?.sanitized_number || p.mobile_phone || p.organization?.phone;
    const foundLinkedin: string | undefined = p.linkedin_url || linkedin_url;
    const foundTitle: string | undefined = p.title;
    const foundCompany: string | undefined = p.organization?.name || o.name || empresa;
    const foundIndustry: string | undefined = p.organization?.industry || o.industry;
    const foundSize: string | undefined = p.organization?.estimated_num_employees || o.estimated_num_employees;

    // ---- Playbook con IA ----
    const systemPrompt = `Eres un estratega de outreach B2B de Ferova Agency (agencia colombiana de SEO, GEO/AIO, e-commerce, automatización con IA y asesoría estratégica). Redactás borradores en español neutro, útiles, sin ser vendedores, sin emojis excesivos, sin "excelente publicación". Objetivo: conseguir una llamada de diagnóstico de 20 min.

Devolvés EXCLUSIVAMENTE un JSON con estas claves:
- "playbook_email": borrador de correo en frío (asunto en la primera línea "Asunto: ...", luego cuerpo). Máx 900 caracteres cuerpo.
- "playbook_linkedin_conectar": true si NO parece haber conexión previa (default true si hay LinkedIn), false si claramente ya interactuaron.
- "playbook_linkedin_nota": nota de solicitud de conexión (máx 280 caracteres). Vacío si conectar=false.
- "playbook_linkedin_mensaje": mensaje para enviar tras conectar o como DM (máx 600 caracteres).
- "playbook_whatsapp_mensaje": mensaje de WhatsApp (máx 500 caracteres). Vacío si no hay teléfono.
- "siguiente_accion": resumen numerado corto del paso a paso recomendado (máx 400 caracteres).`;

    const userPrompt = `PROSPECTO
Nombre: ${nombre_contacto}
Cargo: ${foundTitle || 'desconocido'}
Empresa: ${foundCompany || 'desconocida'}
Industria: ${foundIndustry || 'desconocida'}
Tamaño empresa: ${foundSize || 'desconocido'}
Email: ${foundEmail || 'no disponible'}
Teléfono: ${foundPhone || 'no disponible'}
LinkedIn: ${foundLinkedin || 'no disponible'}
Canal de origen del lead: ${canal_origen}
Fuente: ${fuente_url || 'n/a'}

CONTEXTO DE LA PUBLICACIÓN/COMENTARIO ORIGINAL:
"""
${contexto ? contexto.slice(0, 3000) : '(sin contexto adicional; usa datos de Apollo para inferir dolores relevantes a servicios de Ferova)'}
"""

Servicios de Ferova a mencionar solo si son relevantes al dolor detectado: SEO, GEO/AIO (optimización para respuestas de IA), e-commerce (Shopify/Wordpress), automatización con IA (bots, agentes), asesoría estratégica de crecimiento.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': LOVABLE_API_KEY, 'X-Lovable-AIG-SDK': 'manual-fetch' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error(`[apollo-enrich] AI ${aiRes.status}: ${errText}`);
      return new Response(JSON.stringify({ ok: false, message: 'Error generando playbook', status: aiRes.status, details: errText }), {
        status: aiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content;
    let playbook: any = {};
    try { playbook = JSON.parse(content); } catch {
      return new Response(JSON.stringify({ ok: false, message: 'IA devolvió JSON inválido', raw: content }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Si Apollo no dio teléfono, forzar vacío el mensaje de WhatsApp
    if (!foundPhone) playbook.playbook_whatsapp_mensaje = '';

    // ---- Upsert oportunidad ----
    const now = new Date().toISOString();
    const patch: any = {
      apollo_data,
      apollo_enriched_at: now,
      playbook_email: playbook.playbook_email || null,
      playbook_linkedin_conectar: typeof playbook.playbook_linkedin_conectar === 'boolean' ? playbook.playbook_linkedin_conectar : !!foundLinkedin,
      playbook_linkedin_nota: playbook.playbook_linkedin_nota || null,
      playbook_linkedin_mensaje: playbook.playbook_linkedin_mensaje || null,
      playbook_whatsapp_mensaje: playbook.playbook_whatsapp_mensaje || null,
      playbook_generated_at: now,
      siguiente_accion: playbook.siguiente_accion || null,
      updated_at: now,
    };
    // Datos que Apollo enriqueció y que aún no están en la oportunidad
    if (foundEmail && (!oportunidad || !oportunidad.email)) patch.email = foundEmail;
    if (foundPhone && (!oportunidad || !oportunidad.telefono)) patch.telefono = foundPhone;
    if (foundCompany && (!oportunidad || !oportunidad.empresa)) patch.empresa = foundCompany;

    let saved: any;
    if (oportunidad?.id) {
      const { data, error } = await supabase
        .from('crm_oportunidades').update(patch).eq('id', oportunidad.id).select('*').single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabase
        .from('crm_oportunidades').insert({
          nombre_contacto,
          empresa: foundCompany || empresa || null,
          canal_origen: canal_origen as any,
          estado: 'nuevo',
          fuente_url: fuente_url || null,
          telefono: foundPhone || null,
          email: foundEmail || null,
          ...patch,
        }).select('*').single();
      if (error) throw error;
      saved = data;
    }

    return new Response(JSON.stringify({ ok: true, oportunidad: saved, apollo: { person_found: !!p?.id, org_found: !!o?.id } }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[apollo-enrich-playbook] error:', err);
    return new Response(JSON.stringify({ ok: false, message: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

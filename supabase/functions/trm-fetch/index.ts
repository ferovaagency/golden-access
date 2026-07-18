import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Trae la TRM (Tasa Representativa del Mercado, USD->COP) oficial mas reciente.
// Fuente primaria: datos.gov.co (portal de datos abiertos del gobierno colombiano,
// el mismo dataset que usa MauricioRobayo/trm-api), relevante porque los calculos
// de impuestos DIAN de finance_config deben usar la tasa oficial, no una estimada.
// Fallback: fawazahmed0/exchange-api (CDN publico, sin api key) si datos.gov.co
// no responde. Cualquier usuario autenticado de la app de finanzas puede usarlo
// (no requiere ser del equipo Ferova -- es un dato publico util para todos los
// clientes del SaaS).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, message: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, message: "Sesion invalida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fuente 1: datos.gov.co (oficial, Superintendencia Financiera de Colombia)
    try {
      const url = "https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1";
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.ok) {
        const rows = await res.json();
        const row = rows?.[0];
        const valor = row?.valor ? Number(row.valor) : null;
        if (valor && valor > 0) {
          return new Response(JSON.stringify({
            ok: true,
            trm: Math.round(valor),
            source: "datos.gov.co (oficial)",
            vigente_desde: row.vigenciadesde || null,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    } catch (err) {
      console.warn("[trm-fetch] datos.gov.co fallo, probando fallback:", err);
    }

    // Fuente 2 (fallback): CDN publico de fawazahmed0/exchange-api
    try {
      const res = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const valor = data?.usd?.cop ? Number(data.usd.cop) : null;
        if (valor && valor > 0) {
          return new Response(JSON.stringify({
            ok: true,
            trm: Math.round(valor),
            source: "currency-api (referencia, no oficial DIAN)",
            vigente_desde: data?.date || null,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    } catch (err) {
      console.warn("[trm-fetch] fallback tambien fallo:", err);
    }

    return new Response(JSON.stringify({ ok: false, message: "No se pudo obtener la TRM de ninguna fuente. Intenta de nuevo en unos minutos." }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[trm-fetch] error:", err);
    return new Response(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

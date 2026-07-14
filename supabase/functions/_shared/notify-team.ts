import { fetchWithRetry } from './fetch-retry.ts';

// Notifica al equipo por WhatsApp (Evolution API) cuando pasa algo que no debería
// esperar a que alguien abra el Pipeline a revisar -- ej. un lead "Hot" recien
// detectado. Inspirado en el patron de novu (notificaciones proactivas), pero
// reutilizando la instancia de Evolution API que ya existe en vez de sumar un
// servicio de notificaciones nuevo.
//
// Best-effort: nunca debe tumbar el flujo que la llama (analisis de contenido,
// etc.) si el envio falla -- por eso cada destinatario se envuelve en su propio
// try/catch y los errores solo se loguean.
export async function notifyHotLeadWhatsapp(
  admin: { from: (table: string) => any },
  message: string,
): Promise<{ notified: number; attempted: number }> {
  const EVOLUTION_API_URL = (Deno.env.get('EVOLUTION_API_URL') || '').trim().replace(/\/$/, '');
  const EVOLUTION_API_KEY = (Deno.env.get('EVOLUTION_API_KEY') || '').trim();
  const EVOLUTION_INSTANCE_NAME = (Deno.env.get('EVOLUTION_INSTANCE_NAME') || '').trim();
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
    console.warn('[notify-team] Evolution API no configurada, se omite la alerta de WhatsApp.');
    return { notified: 0, attempted: 0 };
  }

  const { data: recipients, error } = await admin
    .from('crm_team_members')
    .select('email, telefono_notificaciones')
    .not('telefono_notificaciones', 'is', null);
  if (error) {
    console.warn('[notify-team] no se pudo leer crm_team_members:', error);
    return { notified: 0, attempted: 0 };
  }

  const targets = (recipients || []).filter((r: any) => (r.telefono_notificaciones || '').trim());
  let notified = 0;
  for (const r of targets) {
    try {
      const to = `${r.telefono_notificaciones.trim()}@s.whatsapp.net`;
      const res = await fetchWithRetry(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
        body: JSON.stringify({ number: to, text: message }),
      });
      if (res.ok) notified++;
      else console.warn(`[notify-team] fallo al notificar a ${r.email}: ${res.status}`);
    } catch (err) {
      console.warn(`[notify-team] error notificando a ${r.email}:`, err);
    }
  }
  return { notified, attempted: targets.length };
}

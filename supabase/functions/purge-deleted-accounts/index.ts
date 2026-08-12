// Purga real de cuentas cuyo período de gracia ya venció
// (business_profile.deletion_scheduled_for < now()).
//
// Se invoca desde un cron programado (cabecera x-cron-secret) o manualmente por
// un owner del equipo. Reutiliza la misma lógica de admin-delete-customer y
// añade el borrado explícito de los embeddings del cerebro, que no dependen de
// un FK con cascade sobre auth.users.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function isOwner(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) return false;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: team } = await admin.from('crm_team_members').select('rol').eq('email', user.email).maybeSingle();
  return team?.rol === 'owner';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, message: 'Metodo no permitido.' }, 405);

  const cronHeader = req.headers.get('x-cron-secret');
  const viaCron = Boolean(CRON_SECRET) && cronHeader === CRON_SECRET;
  if (!viaCron && !(await isOwner(req.headers.get('Authorization')))) {
    return json({ ok: false, message: 'No autorizado' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: due, error } = await admin
    .from('business_profile')
    .select('user_id, deletion_scheduled_for')
    .not('deletion_scheduled_for', 'is', null)
    .lt('deletion_scheduled_for', new Date().toISOString());
  if (error) {
    console.error('[purge-deleted-accounts] query failed', error);
    return json({ ok: false, message: 'No fue posible listar las cuentas a purgar.' }, 500);
  }

  const purged: string[] = [];
  const failed: Array<{ user_id: string; message: string }> = [];

  for (const row of due ?? []) {
    const userId = row.user_id as string;
    try {
      const { data: target } = await admin.auth.admin.getUserById(userId);
      const email = target?.user?.email ?? null;

      // Salvaguarda: nunca purgar a un miembro del equipo interno.
      if (email) {
        const { data: team } = await admin.from('crm_team_members').select('email').eq('email', email).maybeSingle();
        if (team) { failed.push({ user_id: userId, message: 'Cuenta del equipo, omitida.' }); continue; }
      }

      // Embeddings del cerebro: primero los vectores, luego las notas.
      const { data: knowledge } = await admin.from('ferova_knowledge').select('id').eq('owner_user_id', userId);
      const knowledgeIds = (knowledge ?? []).map((k: { id: string }) => k.id);
      if (knowledgeIds.length) {
        const { error: embErr } = await admin.from('ferova_knowledge_embeddings').delete().in('knowledge_id', knowledgeIds);
        if (embErr) throw embErr;
      }
      const { error: kErr } = await admin.from('ferova_knowledge').delete().eq('owner_user_id', userId);
      if (kErr) throw kErr;

      await admin.from('user_subscriptions').delete().eq('user_id', userId);
      if (email) await admin.from('courtesy_access_grants').delete().eq('email', email);

      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      if (delErr) throw delErr;
      purged.push(userId);
    } catch (err) {
      console.error('[purge-deleted-accounts] error purgando', userId, err);
      failed.push({ user_id: userId, message: (err as Error).message });
    }
  }

  return json({ ok: true, purged: purged.length, failed });
});

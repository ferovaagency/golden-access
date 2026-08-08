// Elimina por completo un cliente registrado: cancela suscripciones, borra el
// grant de cortesía y finalmente elimina la cuenta de auth (irreversible).
// Solo un owner puede hacerlo y nunca sobre un miembro del equipo (salvaguarda).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

const BodySchema = z.object({
  user_id: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ ok: false, message: 'No autenticado' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return json({ ok: false, message: 'Sesión inválida' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: team } = await admin.from('crm_team_members').select('email, rol').eq('email', user.email).maybeSingle();
    if (!team || team.rol !== 'owner') return json({ ok: false, message: 'No autorizado' }, 403);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ ok: false, message: 'Parámetros inválidos' }, 400);
    const { user_id } = parsed.data;

    // Salvaguarda: no permitir borrarse a sí misma ni a un miembro del equipo.
    if (user_id === user.id) return json({ ok: false, message: 'No puedes eliminar tu propia cuenta desde aquí.' }, 400);

    const { data: target, error: targetErr } = await admin.auth.admin.getUserById(user_id);
    if (targetErr) throw targetErr;
    const targetEmail = target?.user?.email;
    if (targetEmail) {
      const { data: targetTeam } = await admin.from('crm_team_members').select('email').eq('email', targetEmail).maybeSingle();
      if (targetTeam) return json({ ok: false, message: 'Esta cuenta pertenece al equipo de Ferova y no se puede eliminar desde aquí.' }, 400);
    }

    // Limpieza de rastros que no dependan de FK cascade sobre auth.users.
    await admin.from('user_subscriptions').delete().eq('user_id', user_id);
    if (targetEmail) await admin.from('courtesy_access_grants').delete().eq('email', targetEmail);

    // Elimina la cuenta. Las tablas con FK a auth.users (con on delete cascade)
    // se limpian solas; el resto queda huérfano sin afectar la operación.
    const { error: delErr } = await admin.auth.admin.deleteUser(user_id);
    if (delErr) throw delErr;

    return json({ ok: true });
  } catch (err) {
    console.error('[admin-delete-customer] error:', err);
    return json({ ok: false, message: (err as Error).message }, 500);
  }
});

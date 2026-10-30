// Panel de Funciones (Administración Ferova): listar llaves y cambiar su
// estado (interno → beta → publicado), su plan mínimo y los correos en beta.
// Solo el equipo Ferova con rol owner. Cada cambio de estado queda en
// feature_flag_changes con motivo y autor.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod';

const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }),
  z.object({
    action: z.literal('set'),
    key: z.string().regex(/^[a-z0-9_]{2,40}$/),
    estado: z.enum(['interno', 'beta', 'publicado']).optional(),
    plan_minimo: z.enum(['basico', 'intermedio', 'full']).nullable().optional(),
    motivo: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal('create'),
    key: z.string().regex(/^[a-z0-9_]{2,40}$/),
    nombre: z.string().min(2).max(80),
    descripcion: z.string().max(300).optional(),
  }),
  z.object({ action: z.literal('add_user'), key: z.string(), email: z.string().email() }),
  z.object({ action: z.literal('remove_user'), key: z.string(), email: z.string().email() }),
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ ok: false, message: 'No autenticado' }, 401);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return json({ ok: false, message: 'Sesión inválida' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: team } = await admin.from('crm_team_members').select('email, rol').eq('email', user.email).maybeSingle();
    if (!team || team.rol !== 'owner') return json({ ok: false, message: 'No autorizado' }, 403);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ ok: false, message: 'Cuerpo inválido', issues: parsed.error.issues }, 400);
    const body = parsed.data;

    if (body.action === 'create') {
      const { error } = await admin.from('feature_flags').insert({ key: body.key, nombre: body.nombre, descripcion: body.descripcion ?? null, estado: 'interno', updated_by: user.email });
      if (error) return json({ ok: false, message: error.message }, 400);
      await admin.from('feature_flag_changes').insert({ flag_key: body.key, de: null, a: 'interno', motivo: 'Creada', por: user.email });
    }

    if (body.action === 'set') {
      const { data: actual } = await admin.from('feature_flags').select('estado, plan_minimo').eq('key', body.key).maybeSingle();
      if (!actual) return json({ ok: false, message: 'La función no existe' }, 404);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: user.email };
      if (body.estado) patch.estado = body.estado;
      if (body.plan_minimo !== undefined) patch.plan_minimo = body.plan_minimo;
      const { error } = await admin.from('feature_flags').update(patch).eq('key', body.key);
      if (error) return json({ ok: false, message: error.message }, 400);
      if (body.estado && body.estado !== actual.estado) {
        await admin.from('feature_flag_changes').insert({ flag_key: body.key, de: actual.estado, a: body.estado, motivo: body.motivo ?? null, por: user.email });
      }
    }

    if (body.action === 'add_user') {
      const { error } = await admin.from('feature_flag_users').upsert({ flag_key: body.key, email: body.email.toLowerCase() });
      if (error) return json({ ok: false, message: error.message }, 400);
    }
    if (body.action === 'remove_user') {
      await admin.from('feature_flag_users').delete().eq('flag_key', body.key).eq('email', body.email.toLowerCase());
    }

    // Siempre se devuelve el estado completo para que el panel se refresque.
    const [{ data: flags }, { data: users }, { data: changes }] = await Promise.all([
      admin.from('feature_flags').select('*').order('created_at', { ascending: true }),
      admin.from('feature_flag_users').select('flag_key, email, added_at').order('added_at', { ascending: true }),
      admin.from('feature_flag_changes').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    return json({ ok: true, flags: flags ?? [], users: users ?? [], changes: changes ?? [] });
  } catch (error) {
    console.error('[admin-set-feature]', error);
    return json({ ok: false, message: error instanceof Error ? error.message : String(error) }, 500);
  }
});

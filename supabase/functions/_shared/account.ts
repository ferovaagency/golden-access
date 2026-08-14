import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/**
 * Sobre los datos de QUÉ cuenta está trabajando esta persona ahora mismo.
 *
 * El selector de empresa del navegador cambia la cuenta activa, pero la
 * respuesta NO puede venir del body de la petición: sería dejar que el cliente
 * declare a qué datos accede. Se resuelve en la base, en
 * `active_context_for_user`, que además comprueba el permiso (esa función es
 * SECURITY DEFINER y sólo la puede ejecutar service_role).
 *
 * Sin empresa activa —o sin permiso sobre ella— devuelve la cuenta propia, que
 * es el comportamiento de siempre.
 */
export interface ActiveContext {
  /** Cuenta cuyos datos se leen y escriben. */
  accountId: string;
  /** Organización activa, si la hay. El cerebro la usa para saber de qué
   *  empresa es una nota y hacia dónde puede viajar. */
  orgId: string | null;
}

export async function resolveActiveContext(
  admin: SupabaseClient<any, "public", "public", any, any>,
  userId: string,
): Promise<ActiveContext> {
  const { data, error } = await admin.rpc("active_context_for_user", { p_user: userId });
  if (error) {
    // Ante la duda, la cuenta propia: nunca ampliar el acceso por un fallo.
    console.error("[account] active_context_for_user", error);
    return { accountId: userId, orgId: null };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    accountId: (row?.account_id as string) || userId,
    orgId: (row?.org_id as string | null) ?? null,
  };
}

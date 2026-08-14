import { supabase } from '../integrations/supabase/client';

// Sobre los datos de QUÉ cuenta escribe la aplicación ahora mismo.
//
// `App.tsx` ya resuelve esto (`accountId` del selector de empresa) y se lo pasa
// por props a los componentes. Pero los servicios que no reciben props
// —plannerService, por ejemplo— resolvían el usuario con
// `supabase.auth.getUser()` y escribían con SU id. Dentro de una empresa del
// holding eso apunta a la cuenta equivocada, y desde que la RLS exige la cuenta
// activa la escritura se rechaza: el registro de horas del Planner
// desaparecía sin decir nada.
//
// Esto es un valor de módulo, no un contexto de React, precisamente porque
// quien lo necesita no es un componente.

let cuentaActiva: string | null = null;

export function setActiveAccountId(accountId: string | null): void {
  cuentaActiva = accountId;
}

/** La cuenta activa; si todavía no se resolvió, la propia del usuario. */
export async function getActiveAccountId(): Promise<string | null> {
  if (cuentaActiva) return cuentaActiva;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

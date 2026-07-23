import { supabase } from '../integrations/supabase/client';

/**
 * Catálogo de pasarelas de pago del usuario. Las comisiones no son iguales
 * para toda venta: dependen del medio, del servicio y del cliente. Por eso se
 * definen varias y se elige una al registrar el ingreso, que congela sus
 * tarifas en la venta (histórico correcto aunque la pasarela cambie de precio).
 */
export interface PaymentGateway {
  id: string;
  nombre: string;
  comision_porcentaje: number;
  comision_fija: number;
  comision_retiro: number;
  /** Moneda en la que la pasarela cobra los importes fijos. */
  moneda: 'COP' | 'USD';
  /** True si además hay conversión de moneda al recibir el dinero. */
  aplica_cambio_moneda: boolean;
  activo: boolean;
}

export type PaymentGatewayInput = Omit<PaymentGateway, 'id'>;

export function emptyGateway(): PaymentGatewayInput {
  return { nombre: '', comision_porcentaje: 0, comision_fija: 0, comision_retiro: 0, moneda: 'COP', aplica_cambio_moneda: false, activo: true };
}

function mapRow(row: Record<string, unknown>): PaymentGateway {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ''),
    comision_porcentaje: Number(row.comision_porcentaje ?? 0),
    comision_fija: Number(row.comision_fija ?? 0),
    comision_retiro: Number(row.comision_retiro ?? 0),
    moneda: (row.moneda === 'USD' ? 'USD' : 'COP'),
    aplica_cambio_moneda: Boolean(row.aplica_cambio_moneda),
    activo: row.activo !== false,
  };
}

export async function listPaymentGateways(userId: string): Promise<PaymentGateway[]> {
  const { data, error } = await supabase
    .from('payment_gateways')
    .select('*')
    .eq('user_id', userId)
    .order('nombre');
  if (error) {
    console.error('[paymentGateways] list error:', error);
    return [];
  }
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createPaymentGateway(userId: string, input: PaymentGatewayInput): Promise<PaymentGateway | null> {
  const { data, error } = await supabase
    .from('payment_gateways')
    .insert({ user_id: userId, ...input })
    .select()
    .single();
  if (error) {
    console.error('[paymentGateways] create error:', error);
    throw error;
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function updatePaymentGateway(id: string, patch: Partial<PaymentGatewayInput>): Promise<void> {
  const { error } = await supabase
    .from('payment_gateways')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[paymentGateways] update error:', error);
    throw error;
  }
}

export async function deletePaymentGateway(id: string): Promise<void> {
  const { error } = await supabase.from('payment_gateways').delete().eq('id', id);
  if (error) {
    console.error('[paymentGateways] delete error:', error);
    throw error;
  }
}

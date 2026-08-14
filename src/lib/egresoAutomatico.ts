import { db } from './db';

// Pagar una deuda o una cuenta por pagar tiene que aparecer en Pagos & Egresos.
//
// El resultado real de caja sale SÓLO de `finance_pagos_egresos`: las cuotas de
// deuda y los pagos a proveedores vivían en sus propias tablas, así que el
// dinero salía de verdad y ningún informe se enteraba.
//
// Estos egresos se marcan con `origen` para que la pantalla de Pagos & Egresos
// los muestre pero no los gobierne — su dueño es la deuda o la cuenta por pagar
// que los generó. Ver `overwriteManualPagosEgresos` en financeService.

export type OrigenEgreso = 'deuda' | 'cuenta_por_pagar';

interface EgresoAutomatico {
  /** Id estable derivado del pago: repetir la operación actualiza la misma
   *  fila en vez de duplicar el gasto. */
  id: string;
  fecha: string;
  concepto: string;
  categoria: 'Herramientas' | 'Salarios' | 'Contratistas' | 'Administrativo' | 'Otros';
  monto: number;
  moneda: string;
  origen: OrigenEgreso;
  origen_ref: string;
  metodo_pago?: string | null;
  account_id?: string | null;
  notas?: string | null;
}

/**
 * Crea (o actualiza) el egreso correspondiente a un pago. Devuelve su id, o
 * null si no se pudo: un fallo aquí NO debe tumbar el registro del pago, que es
 * el dato principal — pero se avisa por consola para que no pase inadvertido.
 */
export async function registrarEgresoAutomatico(userId: string, egreso: EgresoAutomatico): Promise<string | null> {
  const { error } = await db('finance_pagos_egresos').upsert({
    user_id: userId,
    id: egreso.id,
    fecha: egreso.fecha,
    concepto: egreso.concepto,
    categoria: egreso.categoria,
    monto: egreso.monto,
    moneda: egreso.moneda,
    metodo_pago: egreso.metodo_pago ?? null,
    account_id: egreso.account_id ?? null,
    notas: egreso.notas ?? null,
    origen: egreso.origen,
    origen_ref: egreso.origen_ref,
  }, { onConflict: 'user_id,id' });
  if (error) {
    console.error('[egresoAutomatico] no se pudo registrar el egreso', error.message);
    return null;
  }
  return egreso.id;
}

/** Quita el egreso de un pago que se deshizo. */
export async function borrarEgresoAutomatico(userId: string, id: string): Promise<void> {
  const { error } = await db('finance_pagos_egresos').delete().eq('user_id', userId).eq('id', id);
  if (error) console.error('[egresoAutomatico] no se pudo borrar el egreso', error.message);
}

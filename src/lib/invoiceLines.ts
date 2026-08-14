// Reparto del pago recibido entre las líneas de una factura.
//
// Una factura con varios ítems son varias filas de venta unidas por
// `numero_factura`, y cuentas por cobrar razona fila a fila. Si el adelanto se
// cargara entero en la primera línea, una factura saldada se vería como una
// línea pagada y el resto pendientes. Se reparte en orden hasta agotarse.
//
// Vive aparte del formulario para poder probarlo: es la única parte de la
// factura donde un error mueve dinero.

export type EstadoPagoLinea = 'Pendiente' | 'Adelanto' | 'Pagado';

export interface RepartoLinea {
  adelanto: number;
  estado_pago: EstadoPagoLinea;
}

/**
 * @param totales total de cada línea (precio × cantidad), en el orden en que se
 *                muestran.
 * @param adelanto dinero recibido para toda la factura.
 */
export function repartirAdelanto(totales: number[], adelanto: number): RepartoLinea[] {
  let restante = Math.max(0, Number(adelanto) || 0);
  return totales.map((totalCrudo) => {
    const total = Math.max(0, Number(totalCrudo) || 0);
    const aplicado = Math.min(restante, total);
    restante -= aplicado;
    return {
      adelanto: aplicado,
      // Una línea sin importe (cantidad 0, o un ítem gratis) no puede quedar
      // "Pendiente" para siempre: no hay nada que cobrar.
      estado_pago: total === 0 ? 'Pagado' : aplicado >= total ? 'Pagado' : aplicado > 0 ? 'Adelanto' : 'Pendiente',
    };
  });
}

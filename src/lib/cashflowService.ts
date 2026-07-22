import { listReceivables, listReceivablePayments, receivableBalance } from './receivablesService';
import { listPayables } from './payablesService';
import { listDebts, listDebtPayments, debtBalance } from './debtsService';
import { listAccounts } from './accountsService';
import { listBudget } from './budgetService';
import type { AppData, Venta } from '../types';
import { convertToCop } from './calculations';

export interface CashflowSnapshot {
  ingresos_reales: number;
  ingresos_pendientes: number;
  gastos_reales: number;
  obligaciones_proximas: number;
  deuda_total: number;
  saldo_actual: number;
  presupuesto_total: number;
  desviacion_pct: number;
  alertas: Array<{ tipo: string; severidad: 'baja' | 'media' | 'alta'; mensaje: string }>;
}

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function isInPeriod(date: string | null | undefined, periodo: string): boolean {
  return Boolean(date && date.startsWith(periodo));
}

function receivedFromSale(venta: Venta, periodo: string): number {
  const payments = venta.abonos || [];
  // New sales always have a dated first payment. Older records may only have
  // `adelanto`, so retain that value as a backwards-compatible fallback.
  if (payments.length > 0) {
    return payments
      .filter((payment) => isInPeriod(payment.fecha, periodo))
      .reduce((sum, payment) => sum + payment.monto, 0);
  }
  return isInPeriod(venta.fecha, periodo) ? venta.adelanto : 0;
}

function outstandingFromSale(venta: Venta): number {
  const paid = (venta.abonos || []).length > 0
    ? (venta.abonos || []).reduce((sum, payment) => sum + payment.monto, 0)
    : venta.adelanto;
  return Math.max(0, venta.cantidad * venta.precio_venta_unitario - paid);
}

/**
 * Consolidates operational controls with the established finance modules.
 * FinanceOperativa remains a register for accounts, debts and invoices; it
 * reads the existing sales and disbursements instead of copying them to a
 * second table (which would double count cash).
 */
export async function buildCashflow(userId: string, periodo: string, appData?: AppData): Promise<CashflowSnapshot> {
  const [receivables, recvPayments, payables, debts, debtPayments, accounts, budget] = await Promise.all([
    listReceivables(userId),
    listReceivablePayments(userId),
    listPayables(userId),
    listDebts(userId),
    listDebtPayments(userId),
    listAccounts(userId),
    listBudget(userId, periodo),
  ]);

  const legacyReceipts = (appData?.ventas || []).reduce((sum, sale) => {
    return sum + convertToCop(receivedFromSale(sale, periodo), sale.moneda, appData!.config.trm);
  }, 0);
  const legacyPending = (appData?.ventas || []).reduce((sum, sale) => {
    return sum + convertToCop(outstandingFromSale(sale), sale.moneda, appData!.config.trm);
  }, 0);
  const legacyExpenses = (appData?.pagosEgresos || [])
    .filter((payment) => isInPeriod(payment.fecha, periodo))
    .reduce((sum, payment) => sum + convertToCop(payment.monto, payment.moneda, appData!.config.trm), 0);

  const ingresos_reales = recvPayments
    .filter((payment) => isInPeriod(payment.fecha, periodo))
    .reduce((s, p) => s + p.monto, 0) + legacyReceipts;
  const ingresos_pendientes = receivables
    .filter((r) => r.estado !== 'pagada' && r.estado !== 'cancelada')
    .reduce((s, r) => s + receivableBalance(r, recvPayments), 0) + legacyPending;
  const gastos_reales = payables
    .filter((p) => p.estado === 'pagada' && isInPeriod(p.fecha_pago_real, periodo))
    .reduce((s, p) => s + (p.monto_pagado || p.valor), 0) + legacyExpenses;
  const obligaciones_proximas = payables
    .filter((p) => p.estado !== 'pagada' && p.estado !== 'cancelada')
    .reduce((s, p) => s + p.valor, 0);
  const deuda_total = debts.filter((d) => d.estado !== 'pagado').reduce((s, d) => s + debtBalance(d, debtPayments), 0);
  const saldo_actual = accounts.reduce((s, a) => s + (a.saldo_inicial || 0), 0) + ingresos_reales - gastos_reales;
  const presupuesto_total = budget.reduce((s, b) => s + b.monto_presupuestado, 0);
  const desviacion_pct = presupuesto_total > 0 ? ((gastos_reales - presupuesto_total) / presupuesto_total) * 100 : 0;

  const alertas: CashflowSnapshot['alertas'] = [];
  for (const r of receivables) {
    const d = daysUntil(r.vencimiento);
    if (r.estado !== 'pagada' && d !== null && d < 0) alertas.push({ tipo: 'cxc_vencida', severidad: 'alta', mensaje: `${r.concepto}: cobro vencido hace ${-d} días.` });
    else if (r.estado !== 'pagada' && d !== null && d <= 5) alertas.push({ tipo: 'cxc_proxima', severidad: 'media', mensaje: `${r.concepto}: vence en ${d} días.` });
  }
  for (const p of payables) {
    const d = daysUntil(p.vencimiento);
    if (p.estado !== 'pagada' && d !== null && d < 0) alertas.push({ tipo: 'cxp_vencida', severidad: 'alta', mensaje: `${p.proveedor}: pago vencido hace ${-d} días.` });
    else if (p.estado !== 'pagada' && d !== null && d <= 5) alertas.push({ tipo: 'cxp_proxima', severidad: 'media', mensaje: `${p.proveedor}: vence en ${d} días.` });
  }
  if (saldo_actual < obligaciones_proximas) alertas.push({ tipo: 'caja_insuficiente', severidad: 'alta', mensaje: `Caja actual (${saldo_actual.toFixed(0)}) menor que obligaciones próximas (${obligaciones_proximas.toFixed(0)}).` });
  if (Math.abs(desviacion_pct) > 20 && presupuesto_total > 0) alertas.push({ tipo: 'presupuesto_desviado', severidad: 'media', mensaje: `Gastos ${desviacion_pct > 0 ? 'exceden' : 'están por debajo del'} presupuesto en ${Math.abs(desviacion_pct).toFixed(1)}%.` });

  return { ingresos_reales, ingresos_pendientes, gastos_reales, obligaciones_proximas, deuda_total, saldo_actual, presupuesto_total, desviacion_pct, alertas };
}

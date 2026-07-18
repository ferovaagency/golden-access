import { listReceivables, listReceivablePayments, receivableBalance } from './receivablesService';
import { listPayables } from './payablesService';
import { listDebts, listDebtPayments, debtBalance } from './debtsService';
import { listAccounts } from './accountsService';
import { listBudget } from './budgetService';

export interface CashflowSnapshot {
  ingresos_reales: number;
  ingresos_pendientes: number;
  gastos_reales: number;
  obligaciones_proximas: number;
  deuda_total: number;
  pagos_tc_estimados: number;
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

export async function buildCashflow(userId: string, periodo: string): Promise<CashflowSnapshot> {
  const [receivables, recvPayments, payables, debts, debtPayments, accounts, budget] = await Promise.all([
    listReceivables(userId),
    listReceivablePayments(userId),
    listPayables(userId),
    listDebts(userId),
    listDebtPayments(userId),
    listAccounts(userId),
    listBudget(userId, periodo),
  ]);

  const ingresos_reales = recvPayments.reduce((s, p) => s + p.monto, 0);
  const ingresos_pendientes = receivables
    .filter((r) => r.estado !== 'pagada' && r.estado !== 'cancelada')
    .reduce((s, r) => s + receivableBalance(r, recvPayments), 0);
  const gastos_reales = payables
    .filter((p) => p.estado === 'pagada')
    .reduce((s, p) => s + (p.monto_pagado || p.valor), 0);
  const obligaciones_proximas = payables
    .filter((p) => p.estado !== 'pagada' && p.estado !== 'cancelada')
    .reduce((s, p) => s + p.valor, 0);
  const deuda_total = debts.filter((d) => d.estado !== 'pagado').reduce((s, d) => s + debtBalance(d, debtPayments), 0);
  const pagos_tc_estimados = accounts
    .filter((a) => a.tipo === 'tarjeta_credito')
    .reduce((s, a) => s + (a.cupo ? Math.max(0, (a.cupo - (a.saldo_inicial || 0))) * 0 : 0), 0); // placeholder — depende de movimientos reales
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

  return { ingresos_reales, ingresos_pendientes, gastos_reales, obligaciones_proximas, deuda_total, pagos_tc_estimados, saldo_actual, presupuesto_total, desviacion_pct, alertas };
}

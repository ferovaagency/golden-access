import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppData } from '../types';
import { listPaymentMethods, createPaymentMethod, deletePaymentMethod, updatePaymentMethod, type PaymentMethod, type PaymentMethodType } from '../lib/paymentMethodsService';
import { listAccounts, createAccount, deleteAccount, updateAccount, type FinanceAccount, type AccountType } from '../lib/accountsService';
import { listDebts, listDebtPayments, createDebt, deleteDebt, updateDebt, addDebtPayment, debtBalance, type Debt, type DebtPayment, type DebtStatus } from '../lib/debtsService';
import { listReceivables, listReceivablePayments, createReceivable, deleteReceivable, updateReceivable, addReceivablePayment, receivableBalance, type Receivable, type ReceivablePayment, type ReceivableStatus } from '../lib/receivablesService';
import { listPayables, createPayable, deletePayable, updatePayable, payableDifference, type Payable, type PayableStatus } from '../lib/payablesService';
import { listBudget, upsertBudgetLine, deleteBudgetLine, seedBudget, type BudgetLine } from '../lib/budgetService';
import { buildCashflow, type CashflowSnapshot } from '../lib/cashflowService';
import { calculateWeightedReceivable } from '../lib/engine/financialEngine';
import { Loader2, Plus, Trash2, AlertTriangle, RefreshCcw, Edit2, X, ExternalLink } from 'lucide-react';
import ComprobanteUpload from './ComprobanteUpload';
import { getAccessToken } from '../lib/supabase';
import { syncPayablesToSheets, syncReceivablesToSheets } from '../lib/sheetsService';
import FinancialStatement from './FinancialStatement';
import { useToast } from './ui/toast';

type SubTab = 'estado' | 'cuentas' | 'metodos' | 'deudas' | 'cobrar' | 'pagar' | 'presupuesto' | 'flujo';

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500';
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700';
const btnGhost = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50';

function currentPeriodo(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FinanceOperativa({ user, appData, formatCop }: { user: User; appData: AppData; formatCop: (n: number) => string }) {
  const [tab, setTab] = useState<SubTab>('flujo');
  const [periodo, setPeriodo] = useState(currentPeriodo());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Finanzas Operativas</h1>
        <p className="text-sm text-slate-500">Cuentas, deudas, por cobrar, por pagar, presupuesto y flujo de caja en un solo lugar.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {(['flujo','estado','cuentas','metodos','deudas','cobrar','pagar','presupuesto'] as SubTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {labels[t]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span>Periodo</span>
          <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs" />
        </div>
      </div>

      {tab === 'flujo' && <FlujoTab userId={user.id} periodo={periodo} appData={appData} formatCop={formatCop} />}
      {tab === 'estado' && <FinancialStatement userId={user.id} appData={appData} period={periodo} formatCop={formatCop} />}
      {tab === 'cuentas' && <AccountsTab userId={user.id} formatCop={formatCop} />}
      {tab === 'metodos' && <PaymentMethodsTab userId={user.id} />}
      {tab === 'deudas' && <DebtsTab userId={user.id} formatCop={formatCop} />}
      {tab === 'cobrar' && <ReceivablesTab userId={user.id} appData={appData} formatCop={formatCop} />}
      {tab === 'pagar' && <PayablesTab userId={user.id} formatCop={formatCop} />}
      {tab === 'presupuesto' && <BudgetTab userId={user.id} appData={appData} periodo={periodo} formatCop={formatCop} />}
    </div>
  );
}

const labels: Record<SubTab, string> = {
  flujo: 'Flujo de caja',
  estado: 'Estado financiero',
  cuentas: 'Cuentas',
  metodos: 'Métodos de pago',
  deudas: 'Deudas',
  cobrar: 'Por cobrar',
  pagar: 'Por pagar',
  presupuesto: 'Presupuesto',
};

/* ------------------ FLUJO ------------------ */
function FlujoTab({ userId, periodo, appData, formatCop }: { userId: string; periodo: string; appData: AppData; formatCop: (n: number) => string }) {
  const [snap, setSnap] = useState<CashflowSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    buildCashflow(userId, periodo, appData).then(setSnap).finally(() => setLoading(false));
  }, [userId, periodo, appData]);
  if (loading || !snap) return <Loader />;
  const kpis: Array<[string, string, string?]> = [
    ['Saldo actual estimado', formatCop(snap.saldo_actual)],
    ['Caja disponible', formatCop(snap.caja_disponible)],
    ['Caja proyectada', formatCop(snap.caja_proyectada)],
    ['Cobros esperados', formatCop(snap.cobros_esperados)],
    ['Ingresos reales (cobros)', formatCop(snap.ingresos_reales)],
    ['Cuentas por cobrar', formatCop(snap.ingresos_pendientes)],
    ['Gastos reales', formatCop(snap.gastos_reales)],
    ['Obligaciones próximas', formatCop(snap.obligaciones_proximas)],
    ['Deuda total', formatCop(snap.deuda_total)],
  ];
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Vista de solo lectura: resume lo que ya cargaste en Cuentas, Deudas, Por cobrar, Por pagar y Presupuesto. No se edita nada aquí — para cambiar un número, ve a la pestaña correspondiente.</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpis.map(([label, value]) => (
          <div key={label} className={cardClass}>
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
          </div>
        ))}
      </div>
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">Presupuesto vs. gasto real</h3>
          <span className={`text-xs font-semibold ${Math.abs(snap.desviacion_pct) > 20 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {snap.presupuesto_total > 0 ? `${snap.desviacion_pct >= 0 ? '+' : ''}${snap.desviacion_pct.toFixed(1)}%` : 'Sin presupuesto'}
          </span>
        </div>
        <div className="text-sm text-slate-600">
          Presupuesto: <strong>{formatCop(snap.presupuesto_total)}</strong> · Gasto real: <strong>{formatCop(snap.gastos_reales)}</strong>
        </div>
      </div>
      {snap.alertas.length > 0 && (
        <div className={cardClass}>
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Alertas</h3>
          <ul className="space-y-2">
            {snap.alertas.map((a, i) => (
              <li key={i} className={`text-sm flex items-start gap-2 ${a.severidad === 'alta' ? 'text-red-700' : a.severidad === 'media' ? 'text-amber-700' : 'text-slate-700'}`}>
                <span className="mt-0.5">•</span> {a.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------ ACCOUNTS ------------------ */
function AccountsTab({ userId, formatCop }: { userId: string; formatCop: (n: number) => string }) {
  const [items, setItems] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', tipo: 'banco' as AccountType, saldo_inicial: 0, moneda: 'COP', cupo: '', corte_dia: '', pago_dia: '' });
  const reload = () => { setLoading(true); listAccounts(userId).then(setItems).finally(() => setLoading(false)); };
  useEffect(() => { reload(); }, [userId]);
  const resetForm = () => {
    setEditingId(null);
    setForm({ nombre: '', tipo: 'banco', saldo_inicial: 0, moneda: 'COP', cupo: '', corte_dia: '', pago_dia: '' });
  };
  const save = async () => {
    if (!form.nombre.trim()) return;
    const input = {
      nombre: form.nombre.trim(), tipo: form.tipo, saldo_inicial: Number(form.saldo_inicial) || 0, moneda: form.moneda,
      cupo: form.cupo ? Number(form.cupo) : null, corte_dia: form.corte_dia ? Number(form.corte_dia) : null, pago_dia: form.pago_dia ? Number(form.pago_dia) : null,
      activo: true,
    };
    if (editingId) await updateAccount(editingId, input);
    else await createAccount(userId, input);
    resetForm();
    reload();
  };
  if (loading) return <Loader />;
  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <h3 className="font-semibold text-slate-900 mb-1">{editingId ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
        <p className="text-xs text-slate-500 mb-3">Dónde vive tu plata: bancos, efectivo, tarjetas de crédito o créditos/préstamos. El saldo inicial es el saldo con el que arrancas a registrar (no hace falta que sea $0). Cupo, día de corte y día de pago solo aplican a tarjetas de crédito.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className={inputClass} placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <select className={inputClass} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as AccountType })}>
            <option value="banco">Banco</option><option value="efectivo">Efectivo</option><option value="tarjeta_credito">Tarjeta de crédito</option><option value="credito_prestamo">Crédito / préstamo</option>
          </select>
          <input className={inputClass} placeholder="Saldo inicial" type="number" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: Number(e.target.value) })} />
          <select className={inputClass} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
            <option>COP</option><option>USD</option>
          </select>
          {form.tipo === 'tarjeta_credito' && (
            <>
              <input className={inputClass} placeholder="Cupo" type="number" value={form.cupo} onChange={(e) => setForm({ ...form, cupo: e.target.value })} />
              <input className={inputClass} placeholder="Día de corte" type="number" value={form.corte_dia} onChange={(e) => setForm({ ...form, corte_dia: e.target.value })} />
              <input className={inputClass} placeholder="Día de pago" type="number" value={form.pago_dia} onChange={(e) => setForm({ ...form, pago_dia: e.target.value })} />
            </>
          )}
          <button onClick={save} className={btnPrimary}>{editingId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {editingId ? 'Guardar' : 'Agregar'}</button>
          {editingId && <button onClick={resetForm} className={btnGhost}><X className="w-3.5 h-3.5" /> Cancelar</button>}
        </div>
      </div>
      <div className={cardClass}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200"><th className="py-2">Nombre</th><th>Tipo</th><th className="text-right">Saldo inicial</th><th className="text-right">Cupo</th><th></th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="py-2 font-medium">{a.nombre}</td><td className="text-slate-500">{a.tipo}</td>
                <td className="text-right">{formatCop(a.saldo_inicial)}</td>
                <td className="text-right">{a.cupo ? formatCop(a.cupo) : '—'}</td>
                <td className="text-right space-x-2">
                  <button onClick={() => { setEditingId(a.id); setForm({ nombre: a.nombre, tipo: a.tipo, saldo_inicial: a.saldo_inicial, moneda: a.moneda, cupo: a.cupo?.toString() || '', corte_dia: a.corte_dia?.toString() || '', pago_dia: a.pago_dia?.toString() || '' }); }} className="text-blue-600 hover:text-blue-700" title="Editar cuenta"><Edit2 className="w-4 h-4 inline" /></button>
                  <button onClick={() => deleteAccount(a.id).then(reload)} className="text-red-600 hover:text-red-700" title="Eliminar cuenta"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-sm">Sin cuentas aún.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------ PAYMENT METHODS ------------------ */
function PaymentMethodsTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', tipo: 'transferencia' as PaymentMethodType });
  const reload = () => { setLoading(true); listPaymentMethods(userId).then(setItems).finally(() => setLoading(false)); };
  useEffect(() => { reload(); }, [userId]);
  const resetForm = () => { setEditingId(null); setForm({ nombre: '', tipo: 'transferencia' }); };
  const save = async () => {
    if (!form.nombre.trim()) return;
    if (editingId) await updatePaymentMethod(editingId, { ...form, activo: true });
    else await createPaymentMethod(userId, { ...form, activo: true });
    resetForm();
    reload();
  };
  if (loading) return <Loader />;
  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <h3 className="font-semibold text-slate-900 mb-1">{editingId ? 'Editar método de pago' : 'Nuevo método de pago'}</h3>
        <p className="text-xs text-slate-500 mb-3">No es lo mismo que "Cuentas": aquí registras CÓMO te pagan o pagas (transferencia, efectivo, tarjeta), no dónde queda la plata. Sirve para etiquetar movimientos y ver por qué medio entra o sale más dinero.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className={inputClass} placeholder="Nombre (ej. Bancolombia débito)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <select className={inputClass} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as PaymentMethodType })}>
            <option value="credito">Crédito</option><option value="debito">Débito</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option>
          </select>
          <button onClick={save} className={btnPrimary}>{editingId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {editingId ? 'Guardar' : 'Agregar'}</button>
          {editingId && <button onClick={resetForm} className={btnGhost}><X className="w-3.5 h-3.5" /> Cancelar</button>}
        </div>
      </div>
      <div className={cardClass}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200"><th className="py-2">Nombre</th><th>Tipo</th><th></th></tr></thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b border-slate-100"><td className="py-2 font-medium">{m.nombre}</td><td className="text-slate-500">{m.tipo}</td><td className="text-right space-x-2"><button onClick={() => { setEditingId(m.id); setForm({ nombre: m.nombre, tipo: m.tipo }); }} className="text-blue-600" title="Editar método"><Edit2 className="w-4 h-4 inline" /></button><button onClick={() => deletePaymentMethod(m.id).then(reload)} className="text-red-600" title="Eliminar método"><Trash2 className="w-4 h-4 inline" /></button></td></tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-slate-400 text-sm">Sin métodos aún.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------ DEBTS ------------------ */
function DebtsTab({ userId, formatCop }: { userId: string; formatCop: (n: number) => string }) {
  const [items, setItems] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', saldo_inicial: 0, tasa: '', cuotas: '', fecha_corte: '', fecha_limite: '', estado: 'activo' as DebtStatus, moneda: 'COP' });
  const reload = () => { setLoading(true); Promise.all([listDebts(userId), listDebtPayments(userId)]).then(([d, p]) => { setItems(d); setPayments(p); }).finally(() => setLoading(false)); };
  useEffect(() => { reload(); }, [userId]);
  const resetForm = () => { setEditingId(null); setForm({ nombre: '', saldo_inicial: 0, tasa: '', cuotas: '', fecha_corte: '', fecha_limite: '', estado: 'activo', moneda: 'COP' }); };
  const save = async () => {
    if (!form.nombre.trim()) return;
    const input = { nombre: form.nombre, saldo_inicial: Number(form.saldo_inicial), tasa: form.tasa ? Number(form.tasa) : null, cuotas: form.cuotas ? Number(form.cuotas) : null, fecha_corte: form.fecha_corte || null, fecha_limite: form.fecha_limite || null, estado: form.estado, moneda: form.moneda };
    if (editingId) await updateDebt(editingId, input);
    else await createDebt(userId, input);
    resetForm();
    reload();
  };
  if (loading) return <Loader />;
  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <h3 className="font-semibold text-slate-900 mb-1">{editingId ? 'Editar deuda' : 'Nueva deuda'}</h3>
        <p className="text-xs text-slate-500 mb-3">Créditos o préstamos que TÚ debes (banco, tarjeta a cuotas, préstamo personal) — no facturas de proveedores, eso va en "Por pagar". Tasa es la tasa de interés mensual (ej. 0.021 = 2.1%). Usa "Pagar" en la tabla para registrar cada abono.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className={inputClass} placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <input className={inputClass} type="number" placeholder="Saldo inicial" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: Number(e.target.value) })} />
          <input className={inputClass} type="number" step="0.001" placeholder="Tasa (ej. 0.021)" value={form.tasa} onChange={(e) => setForm({ ...form, tasa: e.target.value })} />
          <input className={inputClass} type="number" placeholder="Cuotas" value={form.cuotas} onChange={(e) => setForm({ ...form, cuotas: e.target.value })} />
          <input className={inputClass} type="date" placeholder="Fecha corte" value={form.fecha_corte} onChange={(e) => setForm({ ...form, fecha_corte: e.target.value })} />
          <input className={inputClass} type="date" placeholder="Fecha límite" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} />
          <button onClick={save} className={btnPrimary}>{editingId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {editingId ? 'Guardar' : 'Agregar'}</button>
          {editingId && <button onClick={resetForm} className={btnGhost}><X className="w-3.5 h-3.5" /> Cancelar</button>}
        </div>
      </div>
      <div className={cardClass}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200"><th className="py-2">Nombre</th><th className="text-right">Saldo</th><th className="text-right">Pagado</th><th className="text-right">Restante</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {items.map((d) => {
              const bal = debtBalance(d, payments);
              const paid = d.saldo_inicial - bal;
              return (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium">{d.nombre}</td>
                  <td className="text-right">{formatCop(d.saldo_inicial)}</td>
                  <td className="text-right text-emerald-700">{formatCop(paid)}</td>
                  <td className="text-right font-semibold">{formatCop(bal)}</td>
                  <td className="text-slate-500">{d.fecha_limite || '—'}</td>
                  <td className="text-slate-500">{d.estado}</td>
                  <td className="text-right space-x-2">
                    <button onClick={() => { setEditingId(d.id); setForm({ nombre: d.nombre, saldo_inicial: d.saldo_inicial, tasa: d.tasa?.toString() || '', cuotas: d.cuotas?.toString() || '', fecha_corte: d.fecha_corte || '', fecha_limite: d.fecha_limite || '', estado: d.estado, moneda: d.moneda }); }} className="text-blue-600 text-xs font-semibold" title="Editar deuda">Editar</button>
                    <button onClick={async () => {
                      const monto = Number(prompt('Monto del pago:') || '0');
                      if (monto > 0) { await addDebtPayment(userId, { debt_id: d.id, fecha: new Date().toISOString().slice(0, 10), monto }); reload(); }
                    }} className="text-blue-600 hover:text-blue-700 text-xs font-semibold">Pagar</button>
                    <button onClick={() => deleteDebt(d.id).then(reload)} className="text-red-600"><Trash2 className="w-4 h-4 inline" /></button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-slate-400 text-sm">Sin deudas registradas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------ RECEIVABLES ------------------ */
function ReceivablesTab({ userId, appData, formatCop }: { userId: string; appData: AppData; formatCop: (n: number) => string }) {
  const [items, setItems] = useState<Receivable[]>([]);
  const [payments, setPayments] = useState<ReceivablePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ cliente_id: '', factura: '', concepto: '', valor: 0, moneda: 'COP', vencimiento: '', estado: 'pendiente' as ReceivableStatus, documento_url: '', documento_nombre: '' });
  const reload = () => { setLoading(true); Promise.all([listReceivables(userId), listReceivablePayments(userId)]).then(([r, p]) => { setItems(r); setPayments(p); const token = getAccessToken(); if (token) void syncReceivablesToSheets(token, r).catch((error) => console.error('[FinanceOperativa] Sheets PorCobrar:', error)); }).finally(() => setLoading(false)); };
  useEffect(() => { reload(); }, [userId]);
  const resetForm = () => { setEditingId(null); setForm({ cliente_id: '', factura: '', concepto: '', valor: 0, moneda: 'COP', vencimiento: '', estado: 'pendiente', documento_url: '', documento_nombre: '' }); };
  const save = async () => {
    if (!form.concepto.trim() || !form.valor) return;
    const input = { cliente_id: form.cliente_id || null, factura: form.factura || null, concepto: form.concepto, valor: form.valor, moneda: form.moneda, vencimiento: form.vencimiento || null, estado: form.estado, documento_url: form.documento_url || null, documento_nombre: form.documento_nombre || null };
    if (editingId) await updateReceivable(editingId, input);
    else await createReceivable(userId, input);
    resetForm();
    reload();
  };
  if (loading) return <Loader />;
  const activeReceivables = items.filter((r) => r.estado !== 'cancelada' && r.estado !== 'pagada');
  const totalSaldo = activeReceivables.reduce((sum, r) => sum + receivableBalance(r, payments), 0);
  const totalCobroEsperado = activeReceivables.reduce((sum, r) => {
    const bal = receivableBalance(r, payments);
    return sum + calculateWeightedReceivable({ saldo: bal, vencimiento: r.vencimiento || null, cancelada: false }).cobroEsperado;
  }, 0);
  return (
    <div className="space-y-4">
      {activeReceivables.length > 0 && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <span className="text-slate-600">Saldo total pendiente: <strong className="text-slate-900">{formatCop(totalSaldo)}</strong></span>
          <span className="text-slate-600">Cobro esperado (ponderado por antigüedad): <strong className="text-blue-700">{formatCop(totalCobroEsperado)}</strong></span>
          <span className="text-slate-400">Sección 4.7 del manual: pondera cada saldo por su probabilidad de cobro según qué tan vencido está — no es una promesa, es una estimación.</span>
        </div>
      )}
      <div className={cardClass}>
        <h3 className="font-semibold text-slate-900 mb-1">{editingId ? 'Editar cuenta por cobrar' : 'Nueva cuenta por cobrar'}</h3>
        <p className="text-xs text-slate-500 mb-3">Plata que un cliente te debe (factura emitida, aún sin pagar). Usa "Abonar" en la tabla cuando el cliente pague parcial o total — el saldo se recalcula solo.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select className={inputClass} value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
            <option value="">— Cliente —</option>
            {appData.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <input className={inputClass} placeholder="Factura #" value={form.factura} onChange={(e) => setForm({ ...form, factura: e.target.value })} />
          <input className={inputClass} placeholder="Concepto" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} />
          <input className={inputClass} type="number" placeholder="Valor" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
          <input className={inputClass} type="date" value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} />
          <select className={inputClass} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}><option>COP</option><option>USD</option></select>
          <div className="md:col-span-2">
            <ComprobanteUpload currentUrl={form.documento_url} currentNombre={form.documento_nombre} label="Subir factura a Drive" onUploaded={(url, nombre) => setForm({ ...form, documento_url: url, documento_nombre: nombre })} />
          </div>
          <button onClick={save} className={btnPrimary}>{editingId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {editingId ? 'Guardar' : 'Agregar'}</button>
          {editingId && <button onClick={resetForm} className={btnGhost}><X className="w-3.5 h-3.5" /> Cancelar</button>}
        </div>
      </div>
      <div className={cardClass}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200"><th className="py-2">Cliente</th><th>Concepto</th><th className="text-right">Valor</th><th className="text-right">Saldo</th><th className="text-right">Cobro esperado</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {items.map((r) => {
              const bal = receivableBalance(r, payments);
              const cli = appData.clientes.find((c) => c.id === r.cliente_id)?.nombre || '—';
              const isActive = r.estado !== 'cancelada' && r.estado !== 'pagada';
              const weighted = isActive ? calculateWeightedReceivable({ saldo: bal, vencimiento: r.vencimiento || null, cancelada: false }) : null;
              return (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2">{cli}</td>
                  <td className="font-medium">{r.concepto}</td>
                  <td className="text-right">{formatCop(r.valor)}</td>
                  <td className="text-right font-semibold">{formatCop(bal)}</td>
                  <td className="text-right text-blue-700" title={weighted ? `${(weighted.probabilidad * 100).toFixed(0)}% de probabilidad de cobro` : undefined}>
                    {weighted ? formatCop(weighted.cobroEsperado) : '—'}
                  </td>
                  <td className="text-slate-500">{r.vencimiento || '—'}</td>
                  <td className="text-slate-500">{r.estado}</td>
                  <td className="text-right space-x-2">
                    {r.documento_url && <a href={r.documento_url} target="_blank" rel="noreferrer" className="text-emerald-600" title={r.documento_nombre || 'Ver factura en Drive'}><ExternalLink className="w-4 h-4 inline" /></a>}
                    <button onClick={() => { setEditingId(r.id); setForm({ cliente_id: r.cliente_id || '', factura: r.factura || '', concepto: r.concepto, valor: r.valor, moneda: r.moneda, vencimiento: r.vencimiento || '', estado: r.estado, documento_url: r.documento_url || '', documento_nombre: r.documento_nombre || '' }); }} className="text-blue-600 text-xs font-semibold">Editar</button>
                    <button onClick={async () => {
                      const monto = Number(prompt('Monto del abono:') || '0');
                      if (monto > 0) { await addReceivablePayment(userId, { receivable_id: r.id, fecha: new Date().toISOString().slice(0, 10), monto }); reload(); }
                    }} className="text-blue-600 text-xs font-semibold">Abonar</button>
                    <button onClick={() => deleteReceivable(r.id).then(reload)} className="text-red-600"><Trash2 className="w-4 h-4 inline" /></button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-400 text-sm">Sin cuentas por cobrar.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------ PAYABLES ------------------ */
function PayablesTab({ userId, formatCop }: { userId: string; formatCop: (n: number) => string }) {
  const [items, setItems] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ proveedor: '', factura: '', concepto: '', valor: 0, moneda: 'COP', vencimiento: '', estado: 'pendiente' as PayableStatus, documento_url: '', documento_nombre: '' });
  const reload = () => { setLoading(true); listPayables(userId).then((rows) => { setItems(rows); const token = getAccessToken(); if (token) void syncPayablesToSheets(token, rows).catch((error) => console.error('[FinanceOperativa] Sheets PorPagar:', error)); }).finally(() => setLoading(false)); };
  useEffect(() => { reload(); }, [userId]);
  const resetForm = () => { setEditingId(null); setForm({ proveedor: '', factura: '', concepto: '', valor: 0, moneda: 'COP', vencimiento: '', estado: 'pendiente', documento_url: '', documento_nombre: '' }); };
  const save = async () => {
    if (!form.proveedor.trim() || !form.valor) return;
    const input = { proveedor: form.proveedor, factura: form.factura || null, concepto: form.concepto || null, valor: form.valor, moneda: form.moneda, vencimiento: form.vencimiento || null, estado: form.estado, documento_url: form.documento_url || null, documento_nombre: form.documento_nombre || null };
    if (editingId) await updatePayable(editingId, input);
    else await createPayable(userId, input);
    resetForm();
    reload();
  };
  if (loading) return <Loader />;
  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <h3 className="font-semibold text-slate-900 mb-1">{editingId ? 'Editar cuenta por pagar' : 'Nueva cuenta por pagar'}</h3>
        <p className="text-xs text-slate-500 mb-3">Plata que TÚ le debes a un proveedor o contratista (factura recibida, aún sin pagar) — no es una deuda tuya con un banco, eso va en "Deudas". Usa "Pagar" en la tabla cuando la liquides.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className={inputClass} placeholder="Proveedor" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
          <input className={inputClass} placeholder="Factura #" value={form.factura} onChange={(e) => setForm({ ...form, factura: e.target.value })} />
          <input className={inputClass} placeholder="Concepto" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} />
          <input className={inputClass} type="number" placeholder="Valor" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
          <input className={inputClass} type="date" value={form.vencimiento} onChange={(e) => setForm({ ...form, vencimiento: e.target.value })} />
          <select className={inputClass} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}><option>COP</option><option>USD</option></select>
          <div className="md:col-span-2">
            <ComprobanteUpload currentUrl={form.documento_url} currentNombre={form.documento_nombre} label="Subir factura o soporte a Drive" onUploaded={(url, nombre) => setForm({ ...form, documento_url: url, documento_nombre: nombre })} />
          </div>
          <button onClick={save} className={btnPrimary}>{editingId ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {editingId ? 'Guardar' : 'Agregar'}</button>
          {editingId && <button onClick={resetForm} className={btnGhost}><X className="w-3.5 h-3.5" /> Cancelar</button>}
        </div>
      </div>
      <div className={cardClass}>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200"><th className="py-2">Proveedor</th><th>Concepto</th><th className="text-right">Valor</th><th className="text-right">Pagado</th><th className="text-right">Diferencia</th><th>Vence</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="py-2 font-medium">{p.proveedor}</td>
                <td className="text-slate-500">{p.concepto || '—'}</td>
                <td className="text-right">{formatCop(p.valor)}</td>
                <td className="text-right">{p.monto_pagado != null ? formatCop(p.monto_pagado) : '—'}</td>
                <td className={`text-right ${payableDifference(p) !== 0 ? 'text-amber-600 font-semibold' : ''}`}>{p.monto_pagado != null ? formatCop(payableDifference(p)) : '—'}</td>
                <td className="text-slate-500">{p.vencimiento || '—'}</td>
                <td className="text-slate-500">{p.estado}</td>
                <td className="text-right space-x-2">
                  {p.documento_url && <a href={p.documento_url} target="_blank" rel="noreferrer" className="text-emerald-600" title={p.documento_nombre || 'Ver factura en Drive'}><ExternalLink className="w-4 h-4 inline" /></a>}
                  <button onClick={() => { setEditingId(p.id); setForm({ proveedor: p.proveedor, factura: p.factura || '', concepto: p.concepto || '', valor: p.valor, moneda: p.moneda, vencimiento: p.vencimiento || '', estado: p.estado, documento_url: p.documento_url || '', documento_nombre: p.documento_nombre || '' }); }} className="text-blue-600 text-xs font-semibold">Editar</button>
                  <button onClick={async () => {
                    const monto = Number(prompt('Monto pagado:', String(p.valor)) || '0');
                    if (monto > 0) { await updatePayable(p.id, { monto_pagado: monto, fecha_pago_real: new Date().toISOString().slice(0, 10), estado: 'pagada' }); reload(); }
                  }} className="text-blue-600 text-xs font-semibold">Pagar</button>
                  <button onClick={() => deletePayable(p.id).then(reload)} className="text-red-600"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-slate-400 text-sm">Sin cuentas por pagar.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------ BUDGET ------------------ */
function BudgetTab({ userId, appData, periodo, formatCop }: { userId: string; appData: AppData; periodo: string; formatCop: (n: number) => string }) {
  const { success: toastOk } = useToast();
  const [items, setItems] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLine, setEditingLine] = useState<BudgetLine | null>(null);
  const [form, setForm] = useState({ categoria: '', monto_presupuestado: 0 });
  const reload = () => { setLoading(true); listBudget(userId, periodo).then(setItems).finally(() => setLoading(false)); };
  useEffect(() => { reload(); }, [userId, periodo]);
  if (loading) return <Loader />;
  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-semibold text-slate-900">Presupuesto {periodo}</h3>
          <button onClick={async () => { const n = await seedBudget(userId, appData, periodo); toastOk(`Sembradas ${n} categorías desde tus datos reales.`); reload(); }} className={btnGhost}><RefreshCcw className="w-3.5 h-3.5" /> Sembrar desde datos reales</button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Cuánto planeas gastar por categoría este mes (no lo que ya gastaste — eso se compara solo en "Flujo de caja"). "Sembrar desde datos reales" crea una línea por cada categoría de gasto que ya tienes registrada, usando el promedio como punto de partida.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
          <input className={inputClass} placeholder="Categoría" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          <input className={inputClass} type="number" placeholder="Monto presupuestado" value={form.monto_presupuestado} onChange={(e) => setForm({ ...form, monto_presupuestado: Number(e.target.value) })} />
          <button onClick={async () => {
            if (!form.categoria.trim()) return;
            if (editingLine && editingLine.categoria !== form.categoria) await deleteBudgetLine(editingLine.id);
            await upsertBudgetLine(userId, { periodo, categoria: form.categoria, monto_presupuestado: form.monto_presupuestado, moneda: 'COP', origen: 'manual' });
            setForm({ categoria: '', monto_presupuestado: 0 });
            setEditingLine(null);
            reload();
          }} className={btnPrimary}>{editingLine ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {editingLine ? 'Guardar cambios' : 'Guardar'}</button>
          {editingLine && <button onClick={() => { setEditingLine(null); setForm({ categoria: '', monto_presupuestado: 0 }); }} className={btnGhost}><X className="w-3.5 h-3.5" /> Cancelar</button>}
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200"><th className="py-2">Categoría</th><th className="text-right">Presupuestado</th><th>Origen</th><th></th></tr></thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.id} className="border-b border-slate-100">
                <td className="py-2 font-medium">{b.categoria}</td>
                <td className="text-right">{formatCop(b.monto_presupuestado)}</td>
                <td className="text-slate-500">{b.origen}</td>
                <td className="text-right space-x-2"><button onClick={() => { setEditingLine(b); setForm({ categoria: b.categoria, monto_presupuestado: b.monto_presupuestado }); }} className="text-blue-600" title="Editar presupuesto"><Edit2 className="w-4 h-4 inline" /></button><button onClick={() => deleteBudgetLine(b.id).then(reload)} className="text-red-600" title="Eliminar presupuesto"><Trash2 className="w-4 h-4 inline" /></button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400 text-sm">Sin presupuesto para este periodo.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
}

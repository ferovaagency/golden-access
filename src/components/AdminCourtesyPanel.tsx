import React, { useEffect, useState } from 'react';
import { listCourtesyEmails, addCourtesyEmail, removeCourtesyEmail } from '../lib/moduleOverridesService';
import { listPlans, type SaasPlan } from '../lib/plansService';
import { Loader2, Plus, Trash2 } from 'lucide-react';

export default function AdminCourtesyPanel() {
  const [emails, setEmails] = useState<Array<{ id: string; email: string; plan: string; notas: string | null }>>([]);
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: '', plan: 'completo', notas: '' });
  const reload = () => { setLoading(true); Promise.all([listCourtesyEmails(), listPlans()]).then(([e, p]) => { setEmails(e); setPlans(p); }).finally(() => setLoading(false)); };
  useEffect(() => { reload(); }, []);
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Accesos de cortesía</h1>
        <p className="text-sm text-slate-500">Estos correos reciben acceso gratuito al registrarse. También podés editar los planes provisionales.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-3">Autorizar correo</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="correo@dominio.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm md:col-span-1" placeholder="Notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700" onClick={async () => {
            if (!form.email.trim()) return;
            try { await addCourtesyEmail(form.email, form.plan, form.notas); setForm({ email: '', plan: 'completo', notas: '' }); reload(); }
            catch (e: any) { alert(e.message || String(e)); }
          }}><Plus className="w-3.5 h-3.5" /> Autorizar</button>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200"><th className="py-2">Correo</th><th>Plan</th><th>Notas</th><th></th></tr></thead>
          <tbody>
            {emails.map((e) => (
              <tr key={e.id} className="border-b border-slate-100">
                <td className="py-2 font-medium">{e.email}</td>
                <td className="text-slate-500">{e.plan}</td>
                <td className="text-slate-500">{e.notas || '—'}</td>
                <td className="text-right"><button onClick={() => removeCourtesyEmail(e.id).then(reload)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-3">Planes provisionales</h3>
        <p className="text-xs text-slate-500 mb-3">Todos los precios están marcados como provisionales. La pasarela Paddle está preparada pero desactivada hasta que se configure una clave.</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200"><th className="py-2">Plan</th><th>Módulos</th><th className="text-right">USD / mes</th><th>Estado</th></tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="py-2 font-medium">{p.nombre}</td>
                <td className="text-slate-500 text-xs">{p.modulos.join(', ') || '—'}</td>
                <td className="text-right">${p.precio_usd.toFixed(2)}</td>
                <td><span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{p.provisional ? 'Provisional' : 'Activo'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

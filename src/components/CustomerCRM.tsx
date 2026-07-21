import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Plus, Loader2, Trash2, Pencil, X, Phone, Mail, Building2 } from 'lucide-react';
import { Contacto, ContactoEstado, listContactos, upsertContacto, deleteContacto } from '../lib/bizCrmService';
import { useToast, errMsg } from './ui/toast';

interface Props {
  user: User;
}

const COLUMNS: { estado: ContactoEstado; label: string; accent: string }[] = [
  { estado: 'nuevo', label: 'Nuevo', accent: '#64748b' },
  { estado: 'contactado', label: 'Contactado', accent: '#2563eb' },
  { estado: 'negociacion', label: 'Negociación', accent: '#c9a961' },
  { estado: 'ganado', label: 'Ganado', accent: '#10b981' },
  { estado: 'perdido', label: 'Perdido', accent: '#ef4444' },
];

const EMPTY_FORM = {
  nombre_contacto: '', empresa: '', telefono: '', email: '',
  valor_estimado: '', moneda: 'COP' as 'COP' | 'USD',
  notas: '', proxima_accion: '', fecha_proxima_accion: '',
};

function formatMoney(val: number, moneda: 'COP' | 'USD') {
  return new Intl.NumberFormat(moneda === 'COP' ? 'es-CO' : 'en-US', {
    style: 'currency', currency: moneda, maximumFractionDigits: 0,
  }).format(val);
}

export default function CustomerCRM({ user }: Props) {
  const { error: toastErr, confirm: askConfirm } = useToast();
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setContactos(await listContactos(user.id));
    } catch (err: any) {
      toastErr(`Error cargando tus contactos: ${errMsg(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user.id]);

  const openNew = () => { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (c: Contacto) => {
    setEditingId(c.id);
    setForm({
      nombre_contacto: c.nombre_contacto, empresa: c.empresa || '', telefono: c.telefono || '', email: c.email || '',
      valor_estimado: c.valor_estimado != null ? String(c.valor_estimado) : '', moneda: c.moneda,
      notas: c.notas || '', proxima_accion: c.proxima_accion || '', fecha_proxima_accion: c.fecha_proxima_accion || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre_contacto.trim()) return;
    setSaving(true);
    try {
      const id = editingId || `contacto_${Date.now().toString().slice(-6)}`;
      const existing = contactos.find((c) => c.id === editingId);
      await upsertContacto(user.id, {
        id,
        nombre_contacto: form.nombre_contacto.trim(),
        empresa: form.empresa.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        estado: existing?.estado || 'nuevo',
        valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
        moneda: form.moneda,
        notas: form.notas.trim() || null,
        proxima_accion: form.proxima_accion.trim() || null,
        fecha_proxima_accion: form.fecha_proxima_accion || null,
      });
      setModalOpen(false);
      await refresh();
    } catch (err: any) {
      toastErr(`Error guardando: ${errMsg(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (c: Contacto, estado: ContactoEstado) => {
    setContactos((prev) => prev.map((x) => (x.id === c.id ? { ...x, estado } : x)));
    try {
      await upsertContacto(user.id, { ...c, estado });
    } catch (err: any) {
      toastErr(`Error moviendo el contacto: ${errMsg(err)}`);
      refresh();
    }
  };

  const handleDelete = async (c: Contacto) => {
    if (!(await askConfirm({ description: `¿Eliminar a "${c.nombre_contacto}"?`, destructive: true, confirmText: 'Sí, continuar' }))) return;
    try {
      await deleteContacto(user.id, c.id);
      setContactos((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err: any) {
      toastErr(`Error eliminando: ${errMsg(err)}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-semibold text-slate-900">CRM y Ventas</h2>
          <p className="text-xs text-slate-500 mt-1">Tu pipeline de ventas propio -- arrastra tus prospectos por las etapas.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl">
          <Plus className="w-4 h-4" /> Nuevo contacto
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-blue-600 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
        </div>
      )}

      {!loading && contactos.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
          Todavía no tienes contactos. Crea el primero con "Nuevo contacto".
        </div>
      )}

      {!loading && contactos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {COLUMNS.map((col) => {
            const items = contactos.filter((c) => c.estado === col.estado);
            return (
              <div key={col.estado} className="bg-slate-50 rounded-2xl p-3 space-y-3 min-h-[200px]">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold" style={{ color: col.accent }}>{col.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">{items.length}</span>
                </div>
                {items.map((c) => (
                  <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-sm text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-900">{c.nombre_contacto}</span>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(c)} aria-label={`Editar ${c.nombre_contacto}`} className="text-slate-400 hover:text-blue-600">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(c)} aria-label={`Eliminar ${c.nombre_contacto}`} className="text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {c.empresa && <div className="flex items-center gap-1 text-slate-500"><Building2 className="w-3 h-3" />{c.empresa}</div>}
                    {c.telefono && <div className="flex items-center gap-1 text-slate-500"><Phone className="w-3 h-3" />{c.telefono}</div>}
                    {c.email && <div className="flex items-center gap-1 text-slate-500 truncate"><Mail className="w-3 h-3 shrink-0" />{c.email}</div>}
                    {c.valor_estimado != null && (
                      <div className="font-mono font-semibold text-slate-900">{formatMoney(c.valor_estimado, c.moneda)}</div>
                    )}
                    <label className="sr-only" htmlFor={`estado-${c.id}`}>Cambiar etapa de {c.nombre_contacto}</label>
                    <select
                      id={`estado-${c.id}`}
                      value={c.estado}
                      onChange={(e) => handleMove(c, e.target.value as ContactoEstado)}
                      className="w-full bg-slate-50 border border-slate-200 p-1.5 rounded-lg text-[10px]"
                    >
                      {COLUMNS.map((opt) => <option key={opt.estado} value={opt.estado}>{opt.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-slate-900">{editingId ? 'Editar contacto' : 'Nuevo contacto'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Cerrar" className="text-slate-400 hover:text-slate-900">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="cc-nombre" className="block text-xs font-semibold text-slate-600 mb-1">Nombre *</label>
              <input id="cc-nombre" required value={form.nombre_contacto} onChange={(e) => setForm({ ...form, nombre_contacto: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" />
            </div>
            <div>
              <label htmlFor="cc-empresa" className="block text-xs font-semibold text-slate-600 mb-1">Empresa</label>
              <input id="cc-empresa" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="cc-telefono" className="block text-xs font-semibold text-slate-600 mb-1">Teléfono</label>
                <input id="cc-telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" />
              </div>
              <div>
                <label htmlFor="cc-email" className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                <input id="cc-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="cc-valor" className="block text-xs font-semibold text-slate-600 mb-1">Valor estimado</label>
                <input id="cc-valor" type="number" value={form.valor_estimado} onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" />
              </div>
              <div>
                <label htmlFor="cc-moneda" className="block text-xs font-semibold text-slate-600 mb-1">Moneda</label>
                <select id="cc-moneda" value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value as 'COP' | 'USD' })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900">
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="cc-notas" className="block text-xs font-semibold text-slate-600 mb-1">Notas</label>
              <textarea id="cc-notas" rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="cc-accion" className="block text-xs font-semibold text-slate-600 mb-1">Próxima acción</label>
                <input id="cc-accion" value={form.proxima_accion} onChange={(e) => setForm({ ...form, proxima_accion: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" />
              </div>
              <div>
                <label htmlFor="cc-fecha" className="block text-xs font-semibold text-slate-600 mb-1">Fecha</label>
                <input id="cc-fecha" type="date" value={form.fecha_proxima_accion} onChange={(e) => setForm({ ...form, fecha_proxima_accion: e.target.value })} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900" />
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

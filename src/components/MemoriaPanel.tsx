import { useEffect, useState } from 'react';
import { Brain, Globe, Lock, Plus, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react';
import { useToast, errMsg } from './ui/toast';
import { listMemoria, createMemoria, updateMemoria, deleteMemoria, type BrainItem, type BrainScope } from '../lib/brainService';

// Pantalla de Memoria (cerebro del negocio), admin-only.
// Global = conocimiento del equipo; Privado = solo de quien lo escribe.

const inputCls = 'w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40';
const labelCls = 'font-mono uppercase text-[10px] tracking-wider text-slate-500';

export default function MemoriaPanel() {
  const { success, error: toastErr, confirm } = useToast();
  const [items, setItems] = useState<BrainItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BrainScope>('global');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<BrainScope>('global');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { items, isAdmin } = await listMemoria();
      setItems(items);
      setIsAdmin(isAdmin);
      if (!isAdmin) { setFilter('privado'); setScope('privado'); }
    } catch (e) {
      toastErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!title.trim() || !content.trim()) { toastErr('Escribe un título y un contenido.'); return; }
    setSaving(true);
    try {
      await createMemoria({ title: title.trim(), content: content.trim(), scope });
      setTitle(''); setContent('');
      success('Guardado en la memoria.');
      await load();
    } catch (e) {
      toastErr(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: BrainItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  }

  function cancelEdit() {
    setEditingId(null); setEditTitle(''); setEditContent('');
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim() || !editContent.trim()) { toastErr('El título y el contenido no pueden quedar vacíos.'); return; }
    try {
      await updateMemoria({ id, title: editTitle.trim(), content: editContent.trim() });
      cancelEdit();
      success('Actualizado.');
      await load();
    } catch (e) {
      toastErr(errMsg(e));
    }
  }

  async function handleDelete(item: BrainItem) {
    const ok = await confirm({
      description: `¿Borrar "${item.title}" de la memoria? Esta acción no se puede deshacer.`,
      destructive: true,
      confirmText: 'Borrar',
    });
    if (!ok) return;
    try {
      await deleteMemoria(item.id);
      success('Borrado.');
      setItems((prev) => prev.filter((k) => k.id !== item.id));
    } catch (e) {
      toastErr(errMsg(e));
    }
  }

  const visible = items.filter((k) => k.alcance === filter);
  const canWriteGlobal = isAdmin;

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-slate-900">
          <Brain size={22} className="text-[#c9a961]" />
          <h1 className="text-xl font-semibold">Memoria del negocio</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          El cerebro que usa el asistente para responder. Lo <strong>global</strong> lo ve todo el equipo; lo <strong>privado</strong> solo tú.
        </p>
      </header>

      {/* Alta */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-[#c9a961]" />
          <span className={labelCls}>Agregar a la memoria</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Título</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Política de descuento máximo" />
          </div>
          <div>
            <label className={labelCls}>Contenido</label>
            <textarea className={`${inputCls} min-h-[90px] resize-y`} value={content} onChange={(e) => setContent(e.target.value)} placeholder="El dato completo, claro y autocontenido (que se entienda sin contexto)." />
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <label className={labelCls}>Alcance</label>
              <div className="flex gap-2 mt-1">
                {canWriteGlobal && (
                  <button
                    type="button"
                    onClick={() => setScope('global')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${scope === 'global' ? 'bg-[#c9a961] border-[#c9a961] text-black' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    <Globe size={14} /> Global (equipo)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setScope('privado')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${scope === 'privado' ? 'bg-[#c9a961] border-[#c9a961] text-black' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                >
                  <Lock size={14} /> Privado (solo yo)
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#c9a961] hover:bg-[#b09252] text-black text-sm font-medium disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex gap-2 mb-4">
        {(['global', 'privado'] as BrainScope[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${filter === s ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
          >
            {s === 'global' ? <Globe size={14} /> : <Lock size={14} />}
            {s === 'global' ? 'Global (equipo)' : 'Privado (mío)'}
            <span className="opacity-60">{items.filter((k) => k.alcance === s).length}</span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-lg p-10 text-center text-slate-400 text-sm">
          {filter === 'global' ? 'Aún no hay conocimiento global. Agrega el primer dato del negocio arriba.' : 'Aún no hay conocimiento privado tuyo.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-4">
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input className={inputCls} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  <textarea className={`${inputCls} min-h-[80px] resize-y`} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
                      <X size={14} /> Cancelar
                    </button>
                    <button onClick={() => saveEdit(item.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm bg-[#c9a961] hover:bg-[#b09252] text-black">
                      <Check size={14} /> Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-slate-900 text-sm">{item.title}</h3>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.content}</p>
                    {item.source && <span className="inline-block mt-2 text-[10px] font-mono uppercase tracking-wider text-slate-400">{item.source}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(item)} title="Editar" className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(item)} title="Borrar" className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

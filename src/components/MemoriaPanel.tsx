import { useEffect, useRef, useState } from 'react';
import { Brain, Globe, Lock, Plus, Trash2, Pencil, Check, X, Loader2, RefreshCw, Archive, HelpCircle, History, Link as LinkIcon } from 'lucide-react';
import { useToast, errMsg } from './ui/toast';
import { listMemoria, createMemoria, updateMemoria, deleteMemoria, revisarMemoria, syncMemoria, BRAIN_AREAS, BRAIN_ESTADOS, BRAIN_TIPOS, type BrainArea, type BrainEstado, type BrainItem, type BrainScope, type BrainTipo } from '../lib/brainService';

// Pantalla de Memoria (cerebro del negocio).
// "Del negocio" = lo ve todo el que tenga acceso a esta cuenta; Privado = solo quien lo escribe.
//
// Sistema documental (réplica del método de Notion · Bandeja de conocimiento IA):
//   · Todo lo que escribe una IA entra "Por revisar". El asistente SÓLO responde
//     con lo "Aprobado". Lo que escribe una persona a mano queda Aprobado.
//   · Un tema = una página viva: al editar se anota qué cambió (bitácora).
//   · No se borra: se archiva con nota de cierre (qué era, qué se aprendió,
//     dónde quedó).

const PLANTILLA = 'Qué es / qué cambió:\nQué funcionó o no funcionó:\nPor qué importa:\nSiguiente paso:\n(Cifras con fecha. Lo no verificado: PENDIENTE DE VERIFICAR.)';

const estadoTone: Record<BrainEstado, string> = {
  'Por revisar': 'border-amber-200 bg-amber-50 text-amber-800',
  'Aprobado': 'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Requiere decisión': 'border-orange-200 bg-orange-50 text-orange-800',
  'Archivado': 'border-slate-200 bg-slate-100 text-slate-500',
};

const inputCls = 'w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40';
const labelCls = 'font-mono uppercase text-[10px] tracking-wider text-slate-500';

export default function MemoriaPanel() {
  const { success, error: toastErr, confirm } = useToast();
  const [items, setItems] = useState<BrainItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BrainScope>('global');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const autoSynced = useRef(false);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [scope, setScope] = useState<BrainScope>('global');
  const [tipo, setTipo] = useState<BrainTipo>('Nota');
  const [area, setArea] = useState<BrainArea | ''>('');
  const [estadoNuevo, setEstadoNuevo] = useState<BrainEstado>('Aprobado');
  const [enlace, setEnlace] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<BrainEstado | 'todos'>('todos');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTipo, setEditTipo] = useState<BrainTipo>('Nota');
  const [editArea, setEditArea] = useState<BrainArea | ''>('');
  const [editEnlace, setEditEnlace] = useState('');
  const [editCambio, setEditCambio] = useState('');
  const [bitacoraAbierta, setBitacoraAbierta] = useState<string | null>(null);
  const [archivando, setArchivando] = useState<string | null>(null);
  const [notaArchivo, setNotaArchivo] = useState('');

  async function load(): Promise<BrainItem[]> {
    setLoading(true);
    try {
      const { items, isAdmin } = await listMemoria();
      setItems(items);
      setIsAdmin(isAdmin);
      // Antes, a quien no fuera admin del equipo interno se le encerraba en la
      // vista privada. Con el cerebro por negocio eso ya no aplica: cualquiera
      // con acceso a la cuenta escribe la memoria de SU negocio.
      return items;
    } catch (e) {
      toastErr(errMsg(e));
      return [];
    } finally {
      setLoading(false);
    }
  }

  // Construye/actualiza el cerebro desde los datos reales del negocio.
  async function runSync(silent = false) {
    setSyncing(true);
    try {
      const res = await syncMemoria();
      const items = await load();
      if (res.creados > 0) setFilter('privado'); // el auto-conocimiento es privado del usuario
      if (!silent) {
        success(res.creados || res.actualizados
          ? `Cerebro actualizado: ${res.creados} nuevos, ${res.actualizados} al día.`
          : (items.length ? 'El cerebro ya estaba al día.' : 'Aún no hay datos de negocio para recordar. Registra clientes o completa tu perfil.'));
      }
    } catch (e) {
      if (!silent) toastErr(errMsg(e));
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    (async () => {
      const initial = await load();
      // Primera vez con el cerebro vacío: lo construimos solo, en silencio.
      if (!autoSynced.current && initial.length === 0) {
        autoSynced.current = true;
        await runSync(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    if (!title.trim() || !content.trim()) { toastErr('Escribe un título y un contenido.'); return; }
    setSaving(true);
    try {
      await createMemoria({ title: title.trim(), content: content.trim(), scope, tipo, area: area || null, estado: estadoNuevo, enlace_origen: enlace.trim() || null });
      setTitle(''); setContent(''); setEnlace('');
      success(estadoNuevo === 'Aprobado' ? 'Guardado en la memoria.' : `Guardado como "${estadoNuevo}".`);
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
    setEditTipo(item.tipo || 'Nota');
    setEditArea(item.area || '');
    setEditEnlace(item.enlace_origen || '');
    setEditCambio('');
  }

  function cancelEdit() {
    setEditingId(null); setEditTitle(''); setEditContent(''); setEditCambio('');
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim() || !editContent.trim()) { toastErr('El título y el contenido no pueden quedar vacíos.'); return; }
    if (!editCambio.trim()) { toastErr('Escribe qué cambió: un tema es una página viva y cada cambio deja rastro.'); return; }
    try {
      await updateMemoria({ id, title: editTitle.trim(), content: editContent.trim(), tipo: editTipo, area: editArea || null, enlace_origen: editEnlace.trim() || null, cambio: editCambio.trim() });
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

  async function revisar(item: BrainItem, estado: BrainEstado, nota?: string) {
    try {
      await revisarMemoria({ id: item.id, estado, nota });
      success(estado === 'Aprobado' ? 'Aprobado: el asistente ya lo usa.' : estado === 'Archivado' ? 'Archivado con su nota de cierre.' : 'Marcado como "Requiere decisión".');
      setArchivando(null); setNotaArchivo('');
      await load();
    } catch (e) {
      toastErr(errMsg(e));
    }
  }

  const porScope = items.filter((k) => k.alcance === filter);
  const visible = porScope.filter((k) => estadoFilter === 'todos' ? k.estado !== 'Archivado' : k.estado === estadoFilter);
  const pendientes = items.filter((k) => k.estado === 'Por revisar').length;
  const canWriteGlobal = true; // "global" = de este negocio: lo puede escribir cualquiera con acceso a la cuenta.

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-900">
            <Brain size={22} className="text-blue-500" />
            <h1 className="text-xl font-semibold">Memoria del negocio</h1>
          </div>
          <button
            onClick={() => runSync(false)}
            disabled={syncing}
            title="Genera memoria automáticamente desde tu perfil y tus clientes"
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
          >
            {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {syncing ? 'Sincronizando…' : 'Actualizar desde mi negocio'}
          </button>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          El cerebro que usa el asistente para responder. Lo <strong>del negocio</strong> lo ve todo el que tenga acceso a esta cuenta; lo <strong>privado</strong> solo tú. Con “Actualizar desde mi negocio” se construye solo desde tus clientes y tu perfil.
        </p>
        <p className="text-xs text-slate-500 mt-2">
          <strong>Cómo funciona:</strong> lo que guarda el asistente entra <strong>Por revisar</strong> y no se usa hasta que lo apruebes. El asistente sólo responde con lo <strong>Aprobado</strong>. Un tema = una página viva: al editar anotas qué cambió. Nada se borra a la ligera: se <strong>archiva</strong> con nota de cierre.
          {pendientes > 0 && <button type="button" onClick={() => setEstadoFilter('Por revisar')} className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">{pendientes} por revisar</button>}
        </p>
      </header>

      {/* Alta */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-blue-500" />
          <span className={labelCls}>Agregar a la memoria</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Título</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Política de descuento máximo" />
          </div>
          <div>
            <label className={labelCls}>Contenido</label>
            <textarea className={`${inputCls} min-h-[110px] resize-y`} value={content} onChange={(e) => setContent(e.target.value)} placeholder={`El dato completo, claro y autocontenido (que se entienda sin contexto).\n\n${PLANTILLA}`} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className={labelCls}>Tipo</label>
              <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as BrainTipo)}>{BRAIN_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </div>
            <div>
              <label className={labelCls}>Área</label>
              <select className={inputCls} value={area} onChange={(e) => setArea(e.target.value as BrainArea | '')}><option value="">Sin área</option>{BRAIN_AREAS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select className={inputCls} value={estadoNuevo} onChange={(e) => setEstadoNuevo(e.target.value as BrainEstado)} title="Lo que escribes a mano queda Aprobado: tú eres quien revisa.">
                <option value="Aprobado">Aprobado (lo usa el asistente)</option>
                <option value="Por revisar">Por revisar</option>
                <option value="Requiere decisión">Requiere decisión</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Enlace de origen</label>
              <input className={inputCls} value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://… (opcional)" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <label className={labelCls}>Alcance</label>
              <div className="flex gap-2 mt-1">
                {canWriteGlobal && (
                  <button
                    type="button"
                    onClick={() => setScope('global')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${scope === 'global' ? 'bg-blue-500 border-blue-500 text-black' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    <Globe size={14} /> Del negocio
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setScope('privado')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm border transition-colors ${scope === 'privado' ? 'bg-blue-500 border-blue-500 text-black' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                >
                  <Lock size={14} /> Privado (solo yo)
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60"
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
            {s === 'global' ? 'Del negocio' : 'Privado (mío)'}
            <span className="opacity-60">{items.filter((k) => k.alcance === s).length}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['todos', ...BRAIN_ESTADOS] as Array<BrainEstado | 'todos'>).map((e) => (
          <button key={e} onClick={() => setEstadoFilter(e)} className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${estadoFilter === e ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
            {e === 'todos' ? 'Activas' : e} <span className="opacity-60">{e === 'todos' ? porScope.filter((k) => k.estado !== 'Archivado').length : porScope.filter((k) => k.estado === e).length}</span>
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
          {estadoFilter !== 'todos' ? `No hay entradas en "${estadoFilter}".` : filter === 'global' ? 'Aún no hay conocimiento global. Agrega el primer dato del negocio arriba.' : 'Aún no hay conocimiento privado tuyo.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-4">
              {editingId === item.id ? (
                <div className="space-y-2">
                  <input className={inputCls} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  <textarea className={`${inputCls} min-h-[80px] resize-y`} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    <select className={inputCls} value={editTipo} onChange={(e) => setEditTipo(e.target.value as BrainTipo)}>{BRAIN_TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                    <select className={inputCls} value={editArea} onChange={(e) => setEditArea(e.target.value as BrainArea | '')}><option value="">Sin área</option>{BRAIN_AREAS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                    <input className={inputCls} value={editEnlace} onChange={(e) => setEditEnlace(e.target.value)} placeholder="Enlace de origen (opcional)" />
                  </div>
                  <div>
                    <label className={labelCls}>Qué cambió y por qué (obligatorio)</label>
                    <input className={inputCls} value={editCambio} onChange={(e) => setEditCambio(e.target.value)} placeholder="Ej. Se actualizó el tope de descuento: antes 10 %, ahora 15 % desde octubre." />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelEdit} className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
                      <X size={14} /> Cancelar
                    </button>
                    <button onClick={() => saveEdit(item.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white">
                      <Check size={14} /> Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${estadoTone[item.estado] || estadoTone['Aprobado']}`}>{item.estado}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">{item.tipo}</span>
                      {item.area && <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">{item.area}</span>}
                      {item.source && <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">{item.source}</span>}
                      {item.fecha_revision && <span className="text-[10px] text-slate-400">revisado {item.fecha_revision}</span>}
                    </div>
                    <h3 className="font-medium text-slate-900 text-sm mt-1.5">{item.title}</h3>
                    <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.content}</p>
                    {item.enlace_origen && <a href={item.enlace_origen} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline"><LinkIcon size={11} /> origen</a>}
                    {/* Revisión: el método no borra, decide. */}
                    {item.estado !== 'Archivado' && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {item.estado !== 'Aprobado' && <button onClick={() => revisar(item, 'Aprobado')} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"><Check size={12} /> Aprobar</button>}
                        {item.estado !== 'Requiere decisión' && <button onClick={() => revisar(item, 'Requiere decisión')} className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-800 hover:bg-orange-100"><HelpCircle size={12} /> Requiere decisión</button>}
                        <button onClick={() => { setArchivando(archivando === item.id ? null : item.id); setNotaArchivo(''); }} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"><Archive size={12} /> Archivar</button>
                      </div>
                    )}
                    {archivando === item.id && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                        <label className={labelCls}>Nota de cierre: qué era, qué se aprendió, dónde quedó</label>
                        <textarea className={`${inputCls} mt-1 min-h-[60px] resize-y`} value={notaArchivo} onChange={(e) => setNotaArchivo(e.target.value)} placeholder="Ej. Era la política de descuentos 2025; se reemplazó por la de octubre 2026, que está en «Política de descuento máximo»." />
                        <div className="mt-2 flex justify-end gap-2">
                          <button onClick={() => setArchivando(null)} className="rounded px-3 py-1.5 text-xs text-slate-600 hover:bg-white">Cancelar</button>
                          <button onClick={() => revisar(item, 'Archivado', notaArchivo)} disabled={!notaArchivo.trim()} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">Archivar</button>
                        </div>
                      </div>
                    )}
                    {(item.bitacora?.length ?? 0) > 0 && (
                      <div className="mt-2">
                        <button onClick={() => setBitacoraAbierta(bitacoraAbierta === item.id ? null : item.id)} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"><History size={12} /> Bitácora ({item.bitacora.length})</button>
                        {bitacoraAbierta === item.id && (
                          <ul className="mt-1 space-y-0.5 border-l-2 border-slate-200 pl-2 text-[11px] text-slate-500">
                            {[...item.bitacora].reverse().map((b, i) => <li key={i}><span className="font-mono">{b.at.slice(0, 10)}</span> · {b.accion}{b.nota ? ` — ${b.nota}` : ''}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(item)} title="Editar" className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(item)} title="Borrar del todo (prefiere Archivar)" className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
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

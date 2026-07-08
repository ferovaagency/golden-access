import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Loader2, LogOut, Ban, Plus, ExternalLink, Trash2, Send, Bot, CalendarPlus, XCircle, Sparkles, Download, MessageSquare } from 'lucide-react';
import { logout } from '../lib/supabase';
import {
  isTeamMember,
  listOportunidades,
  upsertOportunidad,
  deleteOportunidad,
  listCitas,
  listContenidoPotencial,
  upsertContenidoPotencial,
  getBotConfig,
  saveBotConfig,
  listKnowledge,
  addKnowledge,
  deleteKnowledge,
  sendWhatsapp,
  bookCita,
  cancelCita,
  analyzeContenido,
  listServiciosCatalogo,
  fetchSubredditPosts,
  ServicioCatalogo,
  Oportunidad,
  CitaDiagnostico,
  ContenidoPotencial,
  EstadoOportunidad,
  BotConfig,
  KnowledgeItem,
  RedditPost,
} from '../lib/crmService';

const ESTADOS: EstadoOportunidad[] = ['nuevo', 'contactado', 'calificando', 'propuesta_enviada', 'negociacion', 'ganado', 'perdido'];

export type CRMTab = 'pipeline' | 'citas' | 'contenido' | 'bot';

interface Props {
  user: User;
  embedded?: boolean;
  tab?: CRMTab;
  onTabChange?: (t: CRMTab) => void;
}

export default function AdminCRM({ user, embedded = false, tab: controlledTab, onTabChange }: Props) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [internalTab, setInternalTab] = useState<CRMTab>('pipeline');
  const tab: CRMTab = controlledTab ?? internalTab;
  const setTab = (t: CRMTab) => { if (onTabChange) onTabChange(t); else setInternalTab(t); };
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [citas, setCitas] = useState<CitaDiagnostico[]>([]);
  const [contenido, setContenido] = useState<ContenidoPotencial[]>([]);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [nombreContacto, setNombreContacto] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [canalOrigen, setCanalOrigen] = useState('linkedin');
  const [fuenteUrl, setFuenteUrl] = useState('');
  const [telefono, setTelefono] = useState('');
  const [nuevaServicioId, setNuevaServicioId] = useState('');
  const [nuevaValorEstimado, setNuevaValorEstimado] = useState<string>('');
  const [nuevaMoneda, setNuevaMoneda] = useState<'COP' | 'USD'>('COP');
  const [servicios, setServicios] = useState<ServicioCatalogo[]>([]);

  const [promptDraft, setPromptDraft] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [newKnowledge, setNewKnowledge] = useState('');
  const [newKnowledgeSource, setNewKnowledgeSource] = useState('');
  const [savingKnowledge, setSavingKnowledge] = useState(false);

  const [whatsappDrafts, setWhatsappDrafts] = useState<Record<string, string>>({});
  const [sendingWhatsapp, setSendingWhatsapp] = useState<string | null>(null);

  // Booking form
  const [bookNombre, setBookNombre] = useState('');
  const [bookEmail, setBookEmail] = useState('');
  const [bookTelefono, setBookTelefono] = useState('');
  const [bookOportunidadId, setBookOportunidadId] = useState('');
  const [bookFecha, setBookFecha] = useState('');
  const [bookDuracion, setBookDuracion] = useState(30);
  const [bookNotas, setBookNotas] = useState('');
  const [booking, setBooking] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Content analyzer
  const [anaUrl, setAnaUrl] = useState('');
  const [anaAutor, setAnaAutor] = useState('');
  const [anaPlataforma, setAnaPlataforma] = useState<'linkedin' | 'reddit'>('linkedin');
  const [anaTexto, setAnaTexto] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Reddit subreddit fetcher
  const [subInput, setSubInput] = useState('');
  const [subListing, setSubListing] = useState<'new' | 'hot' | 'top' | 'rising'>('new');
  const [subLimit, setSubLimit] = useState(15);
  const [subTimeframe, setSubTimeframe] = useState<'hour' | 'day' | 'week' | 'month' | 'year' | 'all'>('week');
  const [subPosts, setSubPosts] = useState<RedditPost[]>([]);
  const [fetchingSub, setFetchingSub] = useState(false);
  const [analyzingPostId, setAnalyzingPostId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ok = await isTeamMember(user.email || '');
      setAuthorized(ok);
      if (ok) await refreshAll();
    })();
  }, [user.email]);

  const refreshAll = async () => {
    setLoading(true);
    try {
      const [o, c, k, bc, kn, srv] = await Promise.all([
        listOportunidades(),
        listCitas(),
        listContenidoPotencial(),
        getBotConfig(),
        listKnowledge(),
        listServiciosCatalogo(user.id).catch(() => [] as ServicioCatalogo[]),
      ]);
      setOportunidades(o);
      setCitas(c);
      setContenido(k);
      setBotConfig(bc);
      setPromptDraft(bc.custom_prompt || '');
      setKnowledge(kn);
      setServicios(srv);
    } catch (err: any) {
      alert(`Error cargando el CRM: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBot = async () => {
    if (!botConfig) return;
    try {
      const updated = await saveBotConfig({ bot_enabled: !botConfig.bot_enabled });
      setBotConfig(updated);
    } catch (err: any) {
      alert(`Error activando/desactivando el bot: ${err.message || err}`);
    }
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      const updated = await saveBotConfig({ custom_prompt: promptDraft });
      setBotConfig(updated);
    } catch (err: any) {
      alert(`Error guardando el prompt: ${err.message || err}`);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleAddKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKnowledge.trim()) return;
    setSavingKnowledge(true);
    try {
      await addKnowledge(newKnowledge.trim(), newKnowledgeSource.trim() || undefined);
      setNewKnowledge('');
      setNewKnowledgeSource('');
      setKnowledge(await listKnowledge());
    } catch (err: any) {
      alert(`Error entrenando al bot: ${err.message || err}`);
    } finally {
      setSavingKnowledge(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      await deleteKnowledge(id);
      setKnowledge(knowledge.filter((k) => k.id !== id));
    } catch (err: any) {
      alert(`Error eliminando: ${err.message || err}`);
    }
  };

  const handleSendWhatsapp = async (oportunidadId: string) => {
    const text = whatsappDrafts[oportunidadId]?.trim();
    if (!text) return;
    setSendingWhatsapp(oportunidadId);
    try {
      await sendWhatsapp(oportunidadId, text);
      setWhatsappDrafts({ ...whatsappDrafts, [oportunidadId]: '' });
    } catch (err: any) {
      alert(`Error enviando WhatsApp: ${err.message || err}`);
    } finally {
      setSendingWhatsapp(null);
    }
  };

  const handleBookCita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookNombre.trim() || !bookFecha) return;
    setBooking(true);
    try {
      const created = await bookCita({
        oportunidad_id: bookOportunidadId || null,
        nombre_prospecto: bookNombre.trim(),
        email_prospecto: bookEmail.trim() || null,
        telefono_prospecto: bookTelefono.trim() || null,
        fecha_hora: new Date(bookFecha).toISOString(),
        duracion_min: Number(bookDuracion) || 30,
        notas: bookNotas.trim() || null,
      });
      setCitas([created, ...citas].sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()));
      setBookNombre(''); setBookEmail(''); setBookTelefono('');
      setBookOportunidadId(''); setBookFecha(''); setBookNotas('');
    } catch (err: any) {
      alert(`Error agendando la cita: ${err.message || err}`);
    } finally {
      setBooking(false);
    }
  };

  const handleCancelCita = async (id: string) => {
    if (!window.confirm('¿Cancelar esta cita y eliminarla del calendario?')) return;
    setCancellingId(id);
    try {
      const updated = await cancelCita(id);
      setCitas(citas.map((c) => (c.id === id ? updated : c)));
    } catch (err: any) {
      alert(`Error cancelando: ${err.message || err}`);
    } finally {
      setCancellingId(null);
    }
  };

  const handleAnalyzeContenido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anaUrl.trim() || anaTexto.trim().length < 30) {
      alert('Pega la URL y al menos 30 caracteres del texto de la publicación.');
      return;
    }
    setAnalyzing(true);
    try {
      const created = await analyzeContenido({
        plataforma: anaPlataforma,
        url_publicacion: anaUrl.trim(),
        autor: anaAutor.trim() || null,
        texto: anaTexto.trim(),
      });
      setContenido([created, ...contenido]);
      setAnaUrl(''); setAnaAutor(''); setAnaTexto('');
    } catch (err: any) {
      alert(`Error analizando: ${err.message || err}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFetchSubreddit = async () => {
    const sub = subInput.trim().replace(/^r\//i, '');
    if (!sub) { alert('Escribe el nombre del subreddit (ej. SEO, digitalmarketing, colombia).'); return; }
    setFetchingSub(true);
    try {
      const posts = await fetchSubredditPosts({ subreddit: sub, listing: subListing, limit: subLimit, timeframe: subTimeframe });
      setSubPosts(posts);
    } catch (err: any) {
      alert(`Error trayendo r/${sub}: ${err.message || err}`);
    } finally {
      setFetchingSub(false);
    }
  };

  const handleAnalyzeRedditPost = async (post: RedditPost) => {
    const texto = `${post.title}\n\n${post.selftext || '(publicación sin texto propio; probable link o imagen)'}`;
    if (texto.length < 30) { alert('La publicación es demasiado corta para analizar.'); return; }
    setAnalyzingPostId(post.id);
    try {
      const created = await analyzeContenido({
        plataforma: 'reddit',
        url_publicacion: post.url,
        autor: `u/${post.author} · r/${post.subreddit}`,
        texto,
      });
      setContenido([created, ...contenido]);
    } catch (err: any) {
      alert(`Error analizando: ${err.message || err}`);
    } finally {
      setAnalyzingPostId(null);
    }
  };

  const handleCreateOportunidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreContacto.trim()) return;
    try {
      const valor = nuevaValorEstimado.trim() ? Number(nuevaValorEstimado) : null;
      const created = await upsertOportunidad({
        nombre_contacto: nombreContacto.trim(),
        empresa: empresa.trim() || null,
        canal_origen: canalOrigen as any,
        estado: 'nuevo',
        fuente_url: fuenteUrl.trim() || null,
        telefono: telefono.trim() || null,
        servicio_id: nuevaServicioId || null,
        valor_estimado: valor,
        moneda: valor != null ? nuevaMoneda : null,
      });
      setOportunidades([created, ...oportunidades]);
      setNombreContacto('');
      setEmpresa('');
      setFuenteUrl('');
      setTelefono('');
      setNuevaServicioId('');
      setNuevaValorEstimado('');
    } catch (err: any) {
      alert(`Error creando oportunidad: ${err.message || err}`);
    }
  };

  const handleChangeEstado = async (o: Oportunidad, estado: EstadoOportunidad) => {
    try {
      const updated = await upsertOportunidad({ id: o.id, estado });
      setOportunidades(oportunidades.map((x) => (x.id === o.id ? updated : x)));
    } catch (err: any) {
      alert(`Error actualizando estado: ${err.message || err}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta oportunidad?')) return;
    try {
      await deleteOportunidad(id);
      setOportunidades(oportunidades.filter((o) => o.id !== id));
    } catch (err: any) {
      alert(`Error eliminando: ${err.message || err}`);
    }
  };

  const handleMarkContenido = async (c: ContenidoPotencial, estado: ContenidoPotencial['estado']) => {
    try {
      const updated = await upsertContenidoPotencial({ id: c.id, estado });
      setContenido(contenido.map((x) => (x.id === c.id ? updated : x)));
    } catch (err: any) {
      alert(`Error actualizando contenido: ${err.message || err}`);
    }
  };

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-[#0f0e0c] flex items-center justify-center text-[#e8e3d8]">
        <Loader2 className="w-8 h-8 animate-spin text-[#c9a961]" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#0f0e0c] flex flex-col items-center justify-center gap-4 text-[#e8e3d8] p-6 text-center">
        <Ban className="w-10 h-10 text-[#c97a61]" />
        <p className="font-mono text-sm">No autorizado. {user.email} no está en el equipo de Ferova.</p>
        <button onClick={() => logout()} className="text-[#c9a961] underline text-xs font-mono">
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0e0c] bg-gradient-to-br from-[#0f0e0c] to-[#1a1815] text-[#e8e3d8] font-sans">
      <header className="bg-[#11100e] border-b border-[#2a2620] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-bold text-[#c9a961]">Ferova Growth OS</h1>
          <span className="text-[10px] font-mono text-[#8a8377] uppercase tracking-wider">CRM interno · no visible para clientes</span>
        </div>
        <button onClick={() => logout()} className="text-[#8a8377] hover:text-[#c97a61] flex items-center gap-1 text-xs font-mono">
          <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
        </button>
      </header>

      <nav className="flex gap-2 px-6 py-3 border-b border-[#2a2620] text-xs font-mono">
        {(['pipeline', 'citas', 'contenido', 'bot'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded uppercase tracking-wider font-semibold ${
              tab === t ? 'bg-[#c9a961]/15 text-[#c9a961] border border-[#c9a961]/40' : 'text-[#a39d8e] hover:text-white'
            }`}
          >
            {t === 'pipeline' ? 'Pipeline' : t === 'citas' ? 'Citas de diagnóstico' : t === 'contenido' ? 'Contenido con potencial' : 'Bot de WhatsApp'}
          </button>
        ))}
      </nav>

      <main className="p-6 max-w-6xl mx-auto">
        {loading && (
          <div className="flex items-center gap-2 text-[#c9a961] text-xs font-mono mb-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...
          </div>
        )}

        {tab === 'pipeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleCreateOportunidad} className="lg:col-span-4 bg-[#161412] border border-[#2a2620] rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-[#c9a961] font-mono uppercase text-[10px] tracking-wider font-bold">Nueva oportunidad</h3>
              <input
                value={nombreContacto}
                onChange={(e) => setNombreContacto(e.target.value)}
                placeholder="Nombre de contacto"
                required
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Empresa (opcional)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <select
                value={canalOrigen}
                onChange={(e) => setCanalOrigen(e.target.value)}
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              >
                {['linkedin', 'whatsapp', 'email', 'reddit', 'web', 'googlemaps', 'referido', 'otro'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                value={fuenteUrl}
                onChange={(e) => setFuenteUrl(e.target.value)}
                placeholder="Link de la publicación/perfil (opcional)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="WhatsApp (ej. 573001234567, opcional)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <select
                value={nuevaServicioId}
                onChange={(e) => setNuevaServicioId(e.target.value)}
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              >
                <option value="">Servicio del catálogo (opcional)</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={nuevaValorEstimado}
                  onChange={(e) => setNuevaValorEstimado(e.target.value)}
                  placeholder="Valor estimado (opcional)"
                  className="flex-1 bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                />
                <select
                  value={nuevaMoneda}
                  onChange={(e) => setNuevaMoneda(e.target.value as 'COP' | 'USD')}
                  className="bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                >
                  <option value="COP">COP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Crear
              </button>
            </form>

            <div className="lg:col-span-8 space-y-2">
              {oportunidades.length === 0 && !loading && (
                <p className="text-[#8a8377] text-xs font-mono text-center py-10">Sin oportunidades todavía.</p>
              )}
              {oportunidades.map((o) => {
                const srv = o.servicio_id ? servicios.find((s) => s.id === o.servicio_id) : null;
                const valor = o.valor_estimado ?? null;
                let margen: { abs: number; pct: number; color: string } | null = null;
                if (srv && valor != null && valor > 0) {
                  const abs = valor - srv.costo_unitario;
                  const pct = (abs / valor) * 100;
                  const color = pct >= 50 ? '#a8c98a' : pct >= 20 ? '#c9a961' : '#c97a61';
                  margen = { abs, pct, color };
                }
                const fmt = (n: number, m: 'COP' | 'USD') =>
                  m === 'USD'
                    ? `US$ ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                    : `$ ${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
                return (
                  <div key={o.id} className="bg-[#161412] border border-[#2a2620] rounded-lg p-4 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[160px]">
                        <div className="font-semibold text-[#e8e3d8]">{o.nombre_contacto}</div>
                        <div className="text-[#8a8377] font-mono text-[10px]">
                          {o.empresa || 'Sin empresa'} · {o.canal_origen}{o.telefono ? ` · ${o.telefono}` : ''}
                        </div>
                        {(srv || valor != null) && (
                          <div className="text-[#a39d8e] font-mono text-[10px] mt-1">
                            {srv && <span className="text-[#c9a961]">{srv.nombre}</span>}
                            {srv && valor != null && ' · '}
                            {valor != null && o.moneda && <span>{fmt(valor, o.moneda)}</span>}
                          </div>
                        )}
                      </div>
                      {margen && (
                        <div
                          className="text-right font-mono text-[10px] px-2 py-1 rounded border"
                          style={{ color: margen.color, borderColor: `${margen.color}66`, background: 'rgba(255,255,255,0.02)' }}
                          title={`Margen bruto estimado: ${fmt(margen.abs, o.moneda || 'COP')}`}
                        >
                          <div className="font-bold">{margen.pct.toFixed(0)}%</div>
                          <div className="text-[9px] opacity-80">margen</div>
                        </div>
                      )}
                      {o.fuente_url && (
                        <a href={o.fuente_url} target="_blank" rel="noreferrer" className="text-[#c9a961] flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> ver
                        </a>
                      )}
                      <select
                        value={o.estado}
                        onChange={(e) => handleChangeEstado(o, e.target.value as EstadoOportunidad)}
                        className="bg-[#0f0e0c]/60 border border-[#2a2620] rounded px-2 py-1 text-[#a39d8e] font-mono text-[10px]"
                      >
                        {ESTADOS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button onClick={() => handleDelete(o.id)} className="text-[#c97a61] hover:text-[#e08970]">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>


                  {o.telefono && (
                    <div className="flex gap-2">
                      <input
                        value={whatsappDrafts[o.id] || ''}
                        onChange={(e) => setWhatsappDrafts({ ...whatsappDrafts, [o.id]: e.target.value })}
                        placeholder="Escribe un mensaje de WhatsApp..."
                        className="flex-1 bg-[#0f0e0c]/50 border border-[#2a2620] p-1.5 rounded text-white"
                      />
                      <button
                        onClick={() => handleSendWhatsapp(o.id)}
                        disabled={sendingWhatsapp === o.id || !whatsappDrafts[o.id]?.trim()}
                        className="px-2.5 py-1.5 bg-[#a8c98a]/15 border border-[#a8c98a]/40 text-[#a8c98a] rounded flex items-center gap-1 disabled:opacity-40"
                      >
                        <Send className="w-3 h-3" /> {sendingWhatsapp === o.id ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'citas' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleBookCita} className="lg:col-span-4 bg-[#161412] border border-[#2a2620] rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-[#c9a961] font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                <CalendarPlus className="w-3.5 h-3.5" /> Agendar cita de diagnóstico
              </h3>
              <input
                value={bookNombre}
                onChange={(e) => setBookNombre(e.target.value)}
                placeholder="Nombre del prospecto"
                required
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <input
                type="email"
                value={bookEmail}
                onChange={(e) => setBookEmail(e.target.value)}
                placeholder="Email (recibe invitación de Calendar)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <input
                value={bookTelefono}
                onChange={(e) => setBookTelefono(e.target.value)}
                placeholder="WhatsApp (opcional)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <select
                value={bookOportunidadId}
                onChange={(e) => setBookOportunidadId(e.target.value)}
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              >
                <option value="">Sin vincular a oportunidad</option>
                {oportunidades.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre_contacto}{o.empresa ? ` · ${o.empresa}` : ''}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={bookFecha}
                onChange={(e) => setBookFecha(e.target.value)}
                required
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <div className="flex items-center gap-2">
                <label className="text-[#8a8377] font-mono text-[10px]">Duración (min)</label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={bookDuracion}
                  onChange={(e) => setBookDuracion(Number(e.target.value))}
                  className="w-20 bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                />
              </div>
              <textarea
                value={bookNotas}
                onChange={(e) => setBookNotas(e.target.value)}
                rows={3}
                placeholder="Notas / agenda de la reunión (opcional)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <button
                type="submit"
                disabled={booking}
                className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CalendarPlus className="w-3.5 h-3.5" /> {booking ? 'Creando evento...' : 'Agendar y crear Google Meet'}
              </button>
              <p className="text-[9px] text-[#8a8377] font-mono leading-relaxed">
                Se crea el evento en el Google Calendar del equipo de Ferova, se genera un link de Meet y se envía la invitación al email del prospecto.
              </p>
            </form>

            <div className="lg:col-span-8 space-y-2">
              {citas.length === 0 && !loading && (
                <p className="text-[#8a8377] text-xs font-mono text-center py-10">Sin citas agendadas todavía.</p>
              )}
              {citas.map((c) => (
                <div key={c.id} className={`bg-[#161412] border rounded-lg p-4 flex flex-wrap items-center gap-3 text-xs ${c.estado === 'cancelada' ? 'border-[#2a2620] opacity-60' : 'border-[#2a2620]'}`}>
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-semibold text-[#e8e3d8]">{c.nombre_prospecto}</div>
                    <div className="text-[#8a8377] font-mono text-[10px]">
                      {new Date(c.fecha_hora).toLocaleString('es-CO')} · {c.duracion_min} min
                      {c.email_prospecto ? ` · ${c.email_prospecto}` : ''}
                    </div>
                  </div>
                  <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                    c.estado === 'cancelada'
                      ? 'bg-[#c97a61]/10 text-[#c97a61] border-[#c97a61]/30'
                      : 'bg-[#c9a961]/10 text-[#c9a961] border-[#c9a961]/30'
                  }`}>
                    {c.estado}
                  </span>
                  {c.es_pagada && <span className="text-[10px] font-mono text-[#a8c98a]">Pagada</span>}
                  {c.meet_link && c.estado !== 'cancelada' && (
                    <a href={c.meet_link} target="_blank" rel="noreferrer" className="text-[#c9a961] flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> unirse
                    </a>
                  )}
                  {c.estado !== 'cancelada' && (
                    <button
                      onClick={() => handleCancelCita(c.id)}
                      disabled={cancellingId === c.id}
                      className="text-[#c97a61] hover:text-[#e08970] flex items-center gap-1 text-[10px] font-mono disabled:opacity-40"
                    >
                      <XCircle className="w-3.5 h-3.5" /> {cancellingId === c.id ? 'Cancelando...' : 'Cancelar'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}


        {tab === 'contenido' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleAnalyzeContenido} className="lg:col-span-5 bg-[#161412] border border-[#2a2620] rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-[#c9a961] font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Analizar publicación
              </h3>
              <p className="text-[#8a8377] font-mono text-[10px] leading-relaxed">
                Pegá el link y el texto de una publicación de LinkedIn o Reddit. La IA la puntúa (0-100), explica por qué y redacta un comentario sugerido para que lo publiques manualmente.
              </p>
              <div className="flex gap-2">
                <select
                  value={anaPlataforma}
                  onChange={(e) => setAnaPlataforma(e.target.value as 'linkedin' | 'reddit')}
                  className="bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="reddit">Reddit</option>
                </select>
                <input
                  value={anaAutor}
                  onChange={(e) => setAnaAutor(e.target.value)}
                  placeholder="Autor (opcional)"
                  className="flex-1 bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                />
              </div>
              <input
                value={anaUrl}
                onChange={(e) => setAnaUrl(e.target.value)}
                placeholder="URL de la publicación"
                required
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <textarea
                value={anaTexto}
                onChange={(e) => setAnaTexto(e.target.value)}
                rows={8}
                placeholder="Pegá acá el texto completo de la publicación..."
                required
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white font-mono text-[11px] leading-relaxed"
              />
              <button
                type="submit"
                disabled={analyzing}
                className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" /> {analyzing ? 'Analizando con IA...' : 'Analizar y guardar'}
              </button>
            </form>

            <div className="lg:col-span-5 bg-[#161412] border border-[#2a2620] rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-[#c9a961] font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Traer hilos de un subreddit
              </h3>
              <p className="text-[#8a8377] font-mono text-[10px] leading-relaxed">
                Escribe el nombre de una comunidad (ej. <span className="text-[#c9a961]">SEO</span>, <span className="text-[#c9a961]">digitalmarketing</span>, <span className="text-[#c9a961]">emprendedores</span>). Traemos los hilos más recientes/populares y podés analizar cualquiera con un click.
              </p>
              <div className="flex gap-2">
                <span className="bg-[#0f0e0c]/50 border border-r-0 border-[#2a2620] p-2 rounded-l text-[#8a8377] font-mono">r/</span>
                <input
                  value={subInput}
                  onChange={(e) => setSubInput(e.target.value)}
                  placeholder="SEO"
                  className="flex-1 bg-[#0f0e0c]/50 border border-[#2a2620] border-l-0 p-2 rounded-r text-white font-mono"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={subListing}
                  onChange={(e) => setSubListing(e.target.value as any)}
                  className="bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                >
                  <option value="new">Nuevos</option>
                  <option value="hot">Hot</option>
                  <option value="top">Top</option>
                  <option value="rising">Rising</option>
                </select>
                {subListing === 'top' ? (
                  <select
                    value={subTimeframe}
                    onChange={(e) => setSubTimeframe(e.target.value as any)}
                    className="bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                  >
                    <option value="day">Hoy</option>
                    <option value="week">Semana</option>
                    <option value="month">Mes</option>
                    <option value="year">Año</option>
                    <option value="all">Siempre</option>
                  </select>
                ) : (
                  <div className="bg-[#0f0e0c]/20 border border-dashed border-[#2a2620] p-2 rounded text-[#8a8377] font-mono text-[10px] text-center">—</div>
                )}
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={subLimit}
                  onChange={(e) => setSubLimit(Math.max(1, Math.min(50, Number(e.target.value) || 15)))}
                  className="bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                />
              </div>
              <button
                onClick={handleFetchSubreddit}
                disabled={fetchingSub}
                className="w-full bg-[#a8c98a] hover:bg-[#96b579] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Download className={`w-3.5 h-3.5 ${fetchingSub ? 'animate-pulse' : ''}`} /> {fetchingSub ? 'Trayendo...' : 'Traer hilos'}
              </button>

              {subPosts.length > 0 && (
                <div className="pt-2 border-t border-[#2a2620] space-y-2 max-h-[520px] overflow-y-auto">
                  <p className="text-[9px] font-mono uppercase text-[#8a8377]">{subPosts.length} hilos · r/{subPosts[0]?.subreddit}</p>
                  {subPosts.map((p) => (
                    <div key={p.id} className="bg-[#0f0e0c]/50 border border-[#2a2620] rounded p-3 space-y-1.5">
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-[#e8e3d8] hover:text-[#c9a961] font-semibold text-[11px] leading-snug block">
                        {p.title}
                      </a>
                      <div className="flex items-center gap-3 text-[9px] font-mono text-[#8a8377] flex-wrap">
                        <span>u/{p.author}</span>
                        <span>▲ {p.score}</span>
                        <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" /> {p.num_comments}</span>
                        <span>{Math.round(p.upvote_ratio * 100)}% ↑</span>
                        {p.link_flair_text && <span className="bg-[#c9a961]/10 text-[#c9a961] px-1.5 rounded">{p.link_flair_text}</span>}
                        {!p.is_self && <span className="text-[#c97a61]">link externo</span>}
                      </div>
                      {p.selftext && <p className="text-[10px] text-[#a39d8e] line-clamp-3">{p.selftext.slice(0, 260)}{p.selftext.length > 260 ? '…' : ''}</p>}
                      <button
                        onClick={() => handleAnalyzeRedditPost(p)}
                        disabled={analyzingPostId === p.id}
                        className="w-full mt-1 px-2 py-1 bg-[#c9a961]/15 border border-[#c9a961]/40 text-[#c9a961] rounded text-[10px] font-mono flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        <Sparkles className="w-2.5 h-2.5" /> {analyzingPostId === p.id ? 'Analizando...' : 'Analizar con IA'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-12 space-y-2">
              <h3 className="text-[#a39d8e] font-mono uppercase text-[10px] tracking-wider font-semibold border-b border-[#2a2620] pb-2">
                Historial analizado ({contenido.length})
              </h3>
              {contenido.length === 0 && !loading && (
                <p className="text-[#8a8377] text-xs font-mono text-center py-10">
                  Sin contenido analizado todavía. Usá el formulario de la izquierda para pegar una publicación.
                </p>
              )}
              {contenido.map((c) => (
                <div key={c.id} className="bg-[#161412] border border-[#2a2620] rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <a href={c.url_publicacion} target="_blank" rel="noreferrer" className="text-[#c9a961] flex items-center gap-1 font-semibold">
                      <ExternalLink className="w-3 h-3" /> {c.plataforma} · {c.autor || 'autor desconocido'}
                    </a>
                    <span
                      className="text-[9px] font-mono uppercase px-2 py-0.5 rounded border"
                      style={{
                        color: (c.score_potencial ?? 0) >= 70 ? '#a8c98a' : (c.score_potencial ?? 0) >= 40 ? '#c9a961' : '#8a8377',
                        borderColor: (c.score_potencial ?? 0) >= 70 ? '#a8c98a66' : (c.score_potencial ?? 0) >= 40 ? '#c9a96166' : '#2a2620',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      score {c.score_potencial ?? '-'}
                    </span>
                  </div>
                  {c.resumen && <p className="text-[#a39d8e]">{c.resumen}</p>}
                  {c.razon && <p className="text-[#8a8377] italic text-[11px]">Por qué: {c.razon}</p>}
                  {c.comentario_sugerido && (
                    <div className="bg-[#0f0e0c]/50 border border-[#2a2620] rounded p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono uppercase text-[#8a8377]">Comentario sugerido:</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(c.comentario_sugerido || ''); }}
                          className="text-[9px] font-mono text-[#c9a961] hover:text-[#e8c481] uppercase"
                        >
                          Copiar
                        </button>
                      </div>
                      <p className="text-[#e8e3d8]">{c.comentario_sugerido}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleMarkContenido(c, 'publicado_manual')}
                      className="px-2.5 py-1 bg-[#a8c98a]/15 border border-[#a8c98a]/40 text-[#a8c98a] rounded text-[10px] font-mono"
                    >
                      Ya lo publiqué
                    </button>
                    <button
                      onClick={() => handleMarkContenido(c, 'descartado')}
                      className="px-2.5 py-1 bg-white/[0.03] border border-[#2a2620] text-[#8a8377] rounded text-[10px] font-mono"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'bot' && botConfig && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-[#161412] border border-[#2a2620] rounded-lg p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-[#c9a961] font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" /> Estado del bot
                  </h3>
                  <button
                    onClick={handleToggleBot}
                    className={`px-3 py-1 rounded font-mono text-[10px] font-bold uppercase ${
                      botConfig.bot_enabled
                        ? 'bg-[#a8c98a]/15 text-[#a8c98a] border border-[#a8c98a]/40'
                        : 'bg-white/[0.03] text-[#8a8377] border border-[#2a2620]'
                    }`}
                  >
                    {botConfig.bot_enabled ? 'Activo' : 'Apagado'}
                  </button>
                </div>
                <p className="text-[#8a8377] leading-relaxed">
                  Instancia de WhatsApp: <span className="text-[#a39d8e] font-mono">{botConfig.instance_name}</span>. También puedes
                  escribir "activar bot" / "apagar bot" desde el propio WhatsApp para controlarlo.
                </p>
              </div>

              <div className="bg-[#161412] border border-[#2a2620] rounded-lg p-5 space-y-3 text-xs">
                <h3 className="text-[#c9a961] font-mono uppercase text-[10px] tracking-wider font-bold">Prompt del bot</h3>
                <textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  rows={6}
                  placeholder="Eres el asistente de ventas de Ferova Agency..."
                  className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2.5 rounded text-white"
                />
                <button
                  onClick={handleSavePrompt}
                  disabled={savingPrompt}
                  className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded disabled:opacity-50"
                >
                  {savingPrompt ? 'Guardando...' : 'Guardar prompt'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <form onSubmit={handleAddKnowledge} className="bg-[#161412] border border-[#2a2620] rounded-lg p-5 space-y-3 text-xs">
                <h3 className="text-[#c9a961] font-mono uppercase text-[10px] tracking-wider font-bold">Entrenar con nueva información</h3>
                <textarea
                  value={newKnowledge}
                  onChange={(e) => setNewKnowledge(e.target.value)}
                  rows={3}
                  placeholder="Ej: Nuestros precios son... / Horario de atención... / Política de reembolsos..."
                  required
                  className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2.5 rounded text-white"
                />
                <input
                  value={newKnowledgeSource}
                  onChange={(e) => setNewKnowledgeSource(e.target.value)}
                  placeholder="Fuente (opcional, ej. 'Página de precios')"
                  className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                />
                <button
                  type="submit"
                  disabled={savingKnowledge}
                  className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" /> {savingKnowledge ? 'Entrenando...' : 'Agregar al conocimiento'}
                </button>
              </form>

              <div className="space-y-2">
                {knowledge.length === 0 && (
                  <p className="text-[#8a8377] text-xs font-mono text-center py-6">Sin conocimiento entrenado todavía.</p>
                )}
                {knowledge.map((k) => (
                  <div key={k.id} className="bg-[#161412] border border-[#2a2620] rounded-lg p-3 flex items-start gap-3 text-xs">
                    <div className="flex-1">
                      <p className="text-[#e8e3d8]">{k.content}</p>
                      {k.source && <span className="text-[#8a8377] font-mono text-[10px] block mt-1">Fuente: {k.source}</span>}
                    </div>
                    <button onClick={() => handleDeleteKnowledge(k.id)} className="text-[#c97a61] hover:text-[#e08970] shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

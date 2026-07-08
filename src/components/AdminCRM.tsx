import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Loader2, LogOut, Ban, Plus, ExternalLink, Trash2, Send, Bot, CalendarPlus, XCircle, Sparkles, Download, MessageSquare, Zap, Copy, Search, Star, RefreshCw, CheckCircle2, Link2 } from 'lucide-react';
import { getAccessToken, googleSignIn, logout } from '../lib/supabase';
import { copyText } from '../lib/clipboard';
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
  syncBookingLinkCitas,
  analyzeContenido,
  listServiciosCatalogo,
  fetchSubredditPosts,
  searchRedditByKeywords,
  searchLinkedInByKeywords,
  enrichOportunidadApollo,
  ServicioCatalogo,
  Oportunidad,
  CitaDiagnostico,
  ContenidoPotencial,
  EstadoOportunidad,
  BotConfig,
  KnowledgeItem,
  RedditPost,
  LinkedInSearchResult,
  listResenas,
  scanResenas,
  markResenaRespondida,
  Resena,
  listReviewSources,
  upsertReviewSource,
  deleteReviewSource,
  ReviewSource,
  getWhatsappInstance,
  connectWhatsappInstance,
  WhatsappInstance,
} from '../lib/crmService';

const ESTADOS: EstadoOportunidad[] = ['nuevo', 'contactado', 'calificando', 'propuesta_enviada', 'negociacion', 'ganado', 'perdido'];

export type CRMTab = 'pipeline' | 'citas' | 'contenido' | 'bot' | 'resenas';

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
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [reviewSources, setReviewSources] = useState<ReviewSource[]>([]);
  const [scanningResenas, setScanningResenas] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [sourcePlatform, setSourcePlatform] = useState('google');
  const [sourceName, setSourceName] = useState('Google Business Profile');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceQuery, setSourceQuery] = useState('');
  const [savingSource, setSavingSource] = useState(false);

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
  const [whatsappInstance, setWhatsappInstance] = useState<WhatsappInstance | null>(null);
  const [connectingWhatsapp, setConnectingWhatsapp] = useState(false);

  // Booking form
  const [bookNombre, setBookNombre] = useState('');
  const [bookEmail, setBookEmail] = useState('');
  const [bookTelefono, setBookTelefono] = useState('');
  const [bookOportunidadId, setBookOportunidadId] = useState('');
  const [bookFecha, setBookFecha] = useState('');
  const [bookDuracion, setBookDuracion] = useState(30);
  const [bookNotas, setBookNotas] = useState('');
  const [booking, setBooking] = useState(false);
  const [syncingBookings, setSyncingBookings] = useState(false);
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

  // Reddit keyword search
  const DEFAULT_KEYWORDS = 'SEO, GEO, AIO, e-commerce, Shopify, automatización IA, agente IA, asesoría marketing';
  const DEFAULT_SUBS = 'SEO, bigseo, digitalmarketing, ecommerce, shopify, marketing, emprendedores, Colombia';
  const [kwInput, setKwInput] = useState(DEFAULT_KEYWORDS);
  const [kwSubs, setKwSubs] = useState(DEFAULT_SUBS);
  const [kwSort, setKwSort] = useState<'relevance' | 'new' | 'hot' | 'top' | 'comments'>('new');
  const [kwTimeframe, setKwTimeframe] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [kwLimit, setKwLimit] = useState(20);
  const [kwPosts, setKwPosts] = useState<RedditPost[]>([]);
  const [searchingKw, setSearchingKw] = useState(false);

  // LinkedIn public discovery
  const [liInput, setLiInput] = useState(DEFAULT_KEYWORDS);
  const [liLimit, setLiLimit] = useState(12);
  const [liResults, setLiResults] = useState<LinkedInSearchResult[]>([]);
  const [searchingLi, setSearchingLi] = useState(false);

  // Apollo + playbook por oportunidad
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [expandedPlaybookId, setExpandedPlaybookId] = useState<string | null>(null);
  const [enrichInputs, setEnrichInputs] = useState<Record<string, { linkedin_url: string; dominio: string; contexto: string }>>({});
  const getEnrichInput = (id: string) => enrichInputs[id] || { linkedin_url: '', dominio: '', contexto: '' };
  const setEnrichInput = (id: string, patch: Partial<{ linkedin_url: string; dominio: string; contexto: string }>) =>
    setEnrichInputs({ ...enrichInputs, [id]: { ...getEnrichInput(id), ...patch } });

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
      const [o, c, k, bc, kn, srv, r, rs, wi] = await Promise.all([
        listOportunidades(),
        listCitas(),
        listContenidoPotencial(),
        getBotConfig(),
        listKnowledge(),
        listServiciosCatalogo(user.id).catch(() => [] as ServicioCatalogo[]),
        listResenas().catch(() => [] as Resena[]),
        listReviewSources().catch(() => [] as ReviewSource[]),
        getWhatsappInstance().catch(() => null),
      ]);
      setOportunidades(o);
      setCitas(c);
      setContenido(k);
      setBotConfig(bc);
      setPromptDraft(bc.custom_prompt || '');
      setKnowledge(kn);
      setServicios(srv);
      setResenas(r);
      setReviewSources(rs);
      setWhatsappInstance(wi);
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

  const handleSyncBookingLink = async () => {
    setSyncingBookings(true);
    try {
      const result = await syncBookingLinkCitas(30);
      const [freshCitas, freshOpps] = await Promise.all([listCitas(), listOportunidades()]);
      setCitas(freshCitas);
      setOportunidades(freshOpps);
      alert(`Reservas revisadas: ${result.scanned}. Nuevas citas importadas: ${result.inserted}.`);
    } catch (err: any) {
      alert(`Error sincronizando reservas: ${err.message || err}`);
    } finally {
      setSyncingBookings(false);
    }
  };

  const handleConnectWhatsapp = async () => {
    setConnectingWhatsapp(true);
    try {
      const instance = await connectWhatsappInstance();
      setWhatsappInstance(instance);
    } catch (err: any) {
      alert(`Error generando QR: ${err.message || err}`);
    } finally {
      setConnectingWhatsapp(false);
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

  const handleSearchRedditKw = async () => {
    const keywords = kwInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (keywords.length === 0) { alert('Escribe al menos una palabra clave.'); return; }
    const subreddits = kwSubs.split(',').map((s) => s.trim().replace(/^r\//i, '')).filter(Boolean);
    setSearchingKw(true);
    try {
      const posts = await searchRedditByKeywords({ keywords, subreddits, sort: kwSort, timeframe: kwTimeframe, limit: kwLimit });
      setKwPosts(posts);
    } catch (err: any) {
      alert(`Error buscando: ${err.message || err}`);
    } finally {
      setSearchingKw(false);
    }
  };

  const handleSearchLinkedIn = async () => {
    const keywords = liInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (keywords.length === 0) { alert('Escribe al menos una palabra clave.'); return; }
    setSearchingLi(true);
    try {
      const results = await searchLinkedInByKeywords({ keywords, limit: liLimit });
      setLiResults(results);
    } catch (err: any) {
      alert(`Error buscando en LinkedIn: ${err.message || err}`);
    } finally {
      setSearchingLi(false);
    }
  };

  const handleAnalyzeLinkedInResult = async (result: LinkedInSearchResult) => {
    const texto = `${result.title}\n\n${result.snippet}`;
    if (texto.trim().length < 30) { alert('El resultado no trae suficiente texto para analizar.'); return; }
    setAnalyzingPostId(result.id);
    try {
      const created = await analyzeContenido({
        plataforma: 'linkedin',
        url_publicacion: result.url,
        autor: result.author || null,
        texto,
      });
      setContenido([created, ...contenido]);
    } catch (err: any) {
      alert(`Error analizando: ${err.message || err}`);
    } finally {
      setAnalyzingPostId(null);
    }
  };

  const handleEnrichApollo = async (o: Oportunidad) => {
    const inp = getEnrichInput(o.id);
    setEnrichingId(o.id);
    try {
      const updated = await enrichOportunidadApollo({
        oportunidad_id: o.id,
        linkedin_url: inp.linkedin_url.trim() || undefined,
        dominio: inp.dominio.trim() || undefined,
        contexto_publicacion: inp.contexto.trim() || undefined,
      });
      setOportunidades(oportunidades.map((x) => (x.id === o.id ? updated : x)));
      setExpandedPlaybookId(o.id);
    } catch (err: any) {
      alert(`Error enriqueciendo con Apollo: ${err.message || err}`);
    } finally {
      setEnrichingId(null);
    }
  };

  const copyToClipboard = async (text: string) => {
    await copyText(text);
  };

  const handleScanResenas = async () => {
    setScanningResenas(true);
    setScanResult(null);
    try {
      if (!getAccessToken()) {
        await googleSignIn();
        return;
      }
      const res = await scanResenas(30);
      setScanResult(`Escaneados ${res.scanned} correos · ${res.inserted} nuevas reseñas · ${res.already_saved} ya guardadas · ${res.skipped} sin reseña.`);
      setResenas(await listResenas());
      setReviewSources(await listReviewSources());
    } catch (err: any) {
      alert(`Error escaneando Gmail: ${err.message || err}`);
    } finally {
      setScanningResenas(false);
    }
  };

  const handleAddReviewSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceName.trim() || !sourceUrl.trim()) return;
    setSavingSource(true);
    try {
      const created = await upsertReviewSource({
        plataforma: sourcePlatform.trim().toLowerCase(),
        nombre: sourceName.trim(),
        profile_url: sourceUrl.trim(),
        gmail_query: sourceQuery.trim() || null,
        enabled: true,
      });
      setReviewSources([created, ...reviewSources.filter((s) => s.id !== created.id)]);
      setSourceUrl('');
      setSourceQuery('');
    } catch (err: any) {
      alert(`Error guardando fuente: ${err.message || err}`);
    } finally {
      setSavingSource(false);
    }
  };

  const handleDeleteReviewSource = async (id: string) => {
    try {
      await deleteReviewSource(id);
      setReviewSources(reviewSources.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(`Error eliminando fuente: ${err.message || err}`);
    }
  };

  const handleToggleRespondida = async (r: Resena) => {
    try {
      await markResenaRespondida(r.id, !r.respondida);
      setResenas(resenas.map((x) => (x.id === r.id ? { ...x, respondida: !r.respondida } : x)));
    } catch (err: any) {
      alert(`Error actualizando: ${err.message || err}`);
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
      <div className={`${embedded ? 'py-12' : 'min-h-screen'} bg-[#f7f8fb] flex items-center justify-center text-slate-700`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className={`${embedded ? 'py-12' : 'min-h-screen'} bg-[#f7f8fb] flex flex-col items-center justify-center gap-4 text-slate-700 p-6 text-center`}>
        <Ban className="w-10 h-10 text-red-600" />
        <p className="font-mono text-sm">No autorizado. {user.email} no está en el equipo de Ferova.</p>
        {!embedded && (
          <button onClick={() => logout()} className="text-blue-600 underline text-xs font-mono">
            Cerrar sesión
          </button>
        )}
      </div>
    );
  }

  const bodyClass = embedded ? '' : 'p-6 max-w-6xl mx-auto';
  const outerClass = embedded ? '' : 'ferova-light-theme min-h-screen bg-[#f7f8fb] text-slate-900 font-sans';
  const qrSrc = whatsappInstance?.qr_code
    ? (whatsappInstance.qr_code.startsWith('data:') ? whatsappInstance.qr_code : `data:image/png;base64,${whatsappInstance.qr_code}`)
    : null;
  const kpis = [
    { label: 'Pipeline', value: oportunidades.length, accent: '#c9a961' },
    { label: 'Citas activas', value: citas.filter((c) => c.estado !== 'cancelada').length, accent: '#7ab5c9' },
    { label: 'Contenido analizado', value: contenido.length, accent: '#a8c98a' },
    { label: 'Reseñas sin responder', value: resenas.filter((r) => !r.respondida).length, accent: '#c97a61' },
  ];

  return (
    <div className={outerClass}>
      {!embedded && (
        <>
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-display font-bold text-blue-600">Ferova Growth OS</h1>
              <span className="text-[10px] font-mono text-[#8a8377] uppercase tracking-wider">CRM interno · no visible para clientes</span>
            </div>
            <button onClick={() => logout()} className="text-[#8a8377] hover:text-red-600 flex items-center gap-1 text-xs font-mono">
              <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
            </button>
          </header>

          <nav className="flex gap-2 px-6 py-3 border-b border-slate-200 text-xs font-mono">
            {(['pipeline', 'citas', 'contenido', 'bot', 'resenas'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded uppercase tracking-wider font-semibold ${
                  tab === t ? 'bg-blue-50 text-blue-600 border border-[#c9a961]/40' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t === 'pipeline' ? 'Pipeline' : t === 'citas' ? 'Citas de diagnóstico' : t === 'contenido' ? 'Contenido con potencial' : t === 'bot' ? 'Bot de WhatsApp' : 'Reseñas'}
              </button>
            ))}
          </nav>
        </>
      )}

      <main className={bodyClass}>
        {loading && (
          <div className="flex items-center gap-2 text-blue-600 text-xs font-mono mb-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 lg:grid-cols-[1.4fr_2fr] gap-4">
          <div className="border border-slate-200 rounded-lg p-5 bg-white">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#8a8377]">Growth cockpit</p>
            <h2 className="text-2xl font-display font-semibold text-slate-900 mt-2">CRM interno de Ferova</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Captura demanda, analiza señales, agenda diagnósticos y centraliza reseñas sin enviar nada automáticamente.
            </p>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {kpis.map((item) => (
              <div key={item.label} className="bg-white border border-slate-200 rounded-lg p-4">
                <span className="text-[9px] font-mono uppercase tracking-wider text-[#8a8377]">{item.label}</span>
                <div className="text-2xl font-display font-bold mt-2" style={{ color: item.accent }}>{item.value}</div>
              </div>
            ))}
          </div>
        </section>


        {tab === 'pipeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleCreateOportunidad} className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold">Nueva oportunidad</h3>
              <input
                value={nombreContacto}
                onChange={(e) => setNombreContacto(e.target.value)}
                placeholder="Nombre de contacto"
                required
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
              />
              <input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Empresa (opcional)"
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
              />
              <select
                value={canalOrigen}
                onChange={(e) => setCanalOrigen(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
              >
                {['linkedin', 'whatsapp', 'email', 'reddit', 'web', 'googlemaps', 'referido', 'otro'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                value={fuenteUrl}
                onChange={(e) => setFuenteUrl(e.target.value)}
                placeholder="Link de la publicación/perfil (opcional)"
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
              />
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="WhatsApp (ej. 573001234567, opcional)"
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
              />
              <select
                value={nuevaServicioId}
                onChange={(e) => setNuevaServicioId(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
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
                  className="flex-1 bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                />
                <select
                  value={nuevaMoneda}
                  onChange={(e) => setNuevaMoneda(e.target.value as 'COP' | 'USD')}
                  className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
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
                  <div key={o.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[160px]">
                        <div className="font-semibold text-slate-900">{o.nombre_contacto}</div>
                        <div className="text-[#8a8377] font-mono text-[10px]">
                          {o.empresa || 'Sin empresa'} · {o.canal_origen}{o.telefono ? ` · ${o.telefono}` : ''}
                        </div>
                        {(srv || valor != null) && (
                          <div className="text-slate-500 font-mono text-[10px] mt-1">
                            {srv && <span className="text-blue-600">{srv.nombre}</span>}
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
                        <a href={o.fuente_url} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> ver
                        </a>
                      )}
                      <select
                        value={o.estado}
                        onChange={(e) => handleChangeEstado(o, e.target.value as EstadoOportunidad)}
                        className="bg-slate-50/60 border border-slate-200 rounded px-2 py-1 text-slate-500 font-mono text-[10px]"
                      >
                        {ESTADOS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button onClick={() => handleDelete(o.id)} className="text-red-600 hover:text-[#e08970]">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>


                  {o.telefono && (
                    <div className="flex gap-2">
                      <input
                        value={whatsappDrafts[o.id] || ''}
                        onChange={(e) => setWhatsappDrafts({ ...whatsappDrafts, [o.id]: e.target.value })}
                        placeholder="Escribe un mensaje de WhatsApp..."
                        className="flex-1 bg-slate-50/50 border border-slate-200 p-1.5 rounded text-slate-900"
                      />
                      <button
                        onClick={() => handleSendWhatsapp(o.id)}
                        disabled={sendingWhatsapp === o.id || !whatsappDrafts[o.id]?.trim()}
                        className="px-2.5 py-1.5 bg-[#a8c98a]/15 border border-[#a8c98a]/40 text-emerald-600 rounded flex items-center gap-1 disabled:opacity-40"
                      >
                        <Send className="w-3 h-3" /> {sendingWhatsapp === o.id ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>
                  )}

                  {/* Apollo + Playbook */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase text-[#8a8377]">
                        {o.apollo_enriched_at ? `Enriquecido con Apollo · ${new Date(o.apollo_enriched_at).toLocaleString('es-CO')}` : 'Enriquecer con Apollo + generar playbook IA'}
                      </span>
                      {o.playbook_generated_at && (
                        <button
                          onClick={() => setExpandedPlaybookId(expandedPlaybookId === o.id ? null : o.id)}
                          className="text-[9px] font-mono text-blue-600 uppercase hover:text-[#e8c481]"
                        >
                          {expandedPlaybookId === o.id ? 'Ocultar playbook' : 'Ver playbook'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        value={getEnrichInput(o.id).linkedin_url}
                        onChange={(e) => setEnrichInput(o.id, { linkedin_url: e.target.value })}
                        placeholder="LinkedIn URL (opcional)"
                        className="bg-slate-50/50 border border-slate-200 p-1.5 rounded text-slate-900 text-[11px]"
                      />
                      <input
                        value={getEnrichInput(o.id).dominio}
                        onChange={(e) => setEnrichInput(o.id, { dominio: e.target.value })}
                        placeholder="Dominio empresa (opcional)"
                        className="bg-slate-50/50 border border-slate-200 p-1.5 rounded text-slate-900 text-[11px]"
                      />
                      <button
                        onClick={() => handleEnrichApollo(o)}
                        disabled={enrichingId === o.id}
                        className="px-2.5 py-1.5 bg-blue-50 border border-[#c9a961]/40 text-blue-600 rounded text-[10px] font-mono flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        <Zap className="w-3 h-3" /> {enrichingId === o.id ? 'Procesando...' : 'Apollo + Playbook'}
                      </button>
                    </div>
                    <textarea
                      value={getEnrichInput(o.id).contexto}
                      onChange={(e) => setEnrichInput(o.id, { contexto: e.target.value })}
                      placeholder="Contexto de la publicación / comentario original (opcional pero muy recomendado)"
                      rows={2}
                      className="w-full bg-slate-50/50 border border-slate-200 p-1.5 rounded text-slate-900 text-[11px] font-mono"
                    />

                    {expandedPlaybookId === o.id && o.playbook_generated_at && (
                      <div className="space-y-2 pt-2">
                        {o.siguiente_accion && (
                          <PlaybookCard label="Plan de acción" text={o.siguiente_accion} onCopy={copyToClipboard} accent="#c9a961" />
                        )}
                        {o.playbook_email && (
                          <PlaybookCard label="Correo en frío" text={o.playbook_email} onCopy={copyToClipboard} accent="#a8c98a" />
                        )}
                        {o.playbook_linkedin_conectar && o.playbook_linkedin_nota && (
                          <PlaybookCard label="LinkedIn · Nota de conexión" text={o.playbook_linkedin_nota} onCopy={copyToClipboard} accent="#7ab5c9" />
                        )}
                        {o.playbook_linkedin_mensaje && (
                          <PlaybookCard label={o.playbook_linkedin_conectar ? 'LinkedIn · Mensaje tras conectar' : 'LinkedIn · DM'} text={o.playbook_linkedin_mensaje} onCopy={copyToClipboard} accent="#7ab5c9" />
                        )}
                        {o.playbook_whatsapp_mensaje ? (
                          <PlaybookCard label="WhatsApp" text={o.playbook_whatsapp_mensaje} onCopy={copyToClipboard} accent="#a8c98a" />
                        ) : (
                          <p className="text-[10px] font-mono text-[#8a8377]">Apollo no devolvió teléfono → sin mensaje de WhatsApp.</p>
                        )}
                        {o.apollo_data && (
                          <details className="text-[10px] font-mono text-[#8a8377]">
                            <summary className="cursor-pointer hover:text-slate-500">Ver datos crudos de Apollo</summary>
                            <pre className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded overflow-x-auto max-h-64 text-[10px]">{JSON.stringify(o.apollo_data, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'citas' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleBookCita} className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                <CalendarPlus className="w-3.5 h-3.5" /> Agendar cita de diagnóstico
              </h3>
              <input
                value={bookNombre}
                onChange={(e) => setBookNombre(e.target.value)}
                placeholder="Nombre del prospecto"
                required
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
              />
              <input
                type="email"
                value={bookEmail}
                onChange={(e) => setBookEmail(e.target.value)}
                placeholder="Email (recibe invitación de Calendar)"
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
              />
              <input
                value={bookTelefono}
                onChange={(e) => setBookTelefono(e.target.value)}
                placeholder="WhatsApp (opcional)"
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
              />
              <select
                value={bookOportunidadId}
                onChange={(e) => setBookOportunidadId(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
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
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
              />
              <div className="flex items-center gap-2">
                <label className="text-[#8a8377] font-mono text-[10px]">Duración (min)</label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={bookDuracion}
                  onChange={(e) => setBookDuracion(Number(e.target.value))}
                  className="w-20 bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                />
              </div>
              <textarea
                value={bookNotas}
                onChange={(e) => setBookNotas(e.target.value)}
                rows={3}
                placeholder="Notas / agenda de la reunión (opcional)"
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
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
              <div className="border-t border-slate-200 pt-3 space-y-2">
                <p className="text-[9px] text-slate-500 font-mono leading-relaxed">
                  También reconoce reservas hechas desde tu link público y crea prospecto + oportunidad en pipeline.
                </p>
                <a href="https://calendar.app.google/NuikMY4L6FcUDMUP6" target="_blank" rel="noreferrer" className="block truncate text-[10px] font-mono text-blue-600 hover:underline">
                  calendar.app.google/NuikMY4L6FcUDMUP6
                </a>
                <button
                  type="button"
                  onClick={handleSyncBookingLink}
                  disabled={syncingBookings}
                  className="w-full bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingBookings ? 'animate-spin' : ''}`} />
                  {syncingBookings ? 'Buscando reservas...' : 'Traer reservas del link'}
                </button>
              </div>
            </form>

            <div className="lg:col-span-8 space-y-2">
              {citas.length === 0 && !loading && (
                <p className="text-[#8a8377] text-xs font-mono text-center py-10">Sin citas agendadas todavía.</p>
              )}
              {citas.map((c) => (
                <div key={c.id} className={`bg-white border rounded-lg p-4 flex flex-wrap items-center gap-3 text-xs ${c.estado === 'cancelada' ? 'border-slate-200 opacity-60' : 'border-slate-200'}`}>
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-semibold text-slate-900">{c.nombre_prospecto}</div>
                    <div className="text-[#8a8377] font-mono text-[10px]">
                      {new Date(c.fecha_hora).toLocaleString('es-CO')} · {c.duracion_min} min
                      {c.email_prospecto ? ` · ${c.email_prospecto}` : ''}
                    </div>
                  </div>
                  <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                    c.estado === 'cancelada'
                      ? 'bg-[#c97a61]/10 text-red-600 border-[#c97a61]/30'
                      : 'bg-[#c9a961]/10 text-blue-600 border-[#c9a961]/30'
                  }`}>
                    {c.estado}
                  </span>
                  {c.es_pagada && <span className="text-[10px] font-mono text-emerald-600">Pagada</span>}
                  {c.meet_link && c.estado !== 'cancelada' && (
                    <a href={c.meet_link} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> unirse
                    </a>
                  )}
                  {c.estado !== 'cancelada' && (
                    <button
                      onClick={() => handleCancelCita(c.id)}
                      disabled={cancellingId === c.id}
                      className="text-red-600 hover:text-[#e08970] flex items-center gap-1 text-[10px] font-mono disabled:opacity-40"
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
            <div className="lg:col-span-12 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
              <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Buscar publicaciones públicas de LinkedIn
              </h3>
              <p className="text-[#8a8377] font-mono text-[10px] leading-relaxed">
                Funciona igual que Reddit: busca automáticamente señales públicas relacionadas con servicios de Ferova. Luego eliges qué resultado analizar y guardar.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_110px_150px] gap-2">
                <input
                  value={liInput}
                  onChange={(e) => setLiInput(e.target.value)}
                  placeholder="SEO, Shopify, automatización IA"
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900 font-mono"
                />
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={liLimit}
                  onChange={(e) => setLiLimit(Math.max(1, Math.min(30, Number(e.target.value) || 12)))}
                  className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                />
                <button
                  onClick={handleSearchLinkedIn}
                  disabled={searchingLi}
                  className="bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Search className={`w-3.5 h-3.5 ${searchingLi ? 'animate-pulse' : ''}`} /> {searchingLi ? 'Buscando...' : 'Buscar LinkedIn'}
                </button>
              </div>
              {liResults.length > 0 && (
                <div className="pt-2 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
                  <p className="md:col-span-2 text-[9px] font-mono uppercase text-[#8a8377]">{liResults.length} resultados públicos</p>
                  {liResults.map((result) => (
                    <div key={result.id} className="bg-slate-50/50 border border-slate-200 rounded p-3 space-y-1.5">
                      <a href={result.url} target="_blank" rel="noreferrer" className="text-slate-900 hover:text-blue-600 font-semibold text-[11px] leading-snug block">
                        {result.title}
                      </a>
                      {result.author && <p className="text-[9px] font-mono text-blue-600">{result.author}</p>}
                      {result.snippet && <p className="text-[10px] text-slate-500 line-clamp-3">{result.snippet}</p>}
                      <button
                        onClick={() => handleAnalyzeLinkedInResult(result)}
                        disabled={analyzingPostId === result.id}
                        className="w-full mt-1 px-2 py-1 bg-blue-50 border border-[#c9a961]/40 text-blue-600 rounded text-[10px] font-mono flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        <Sparkles className="w-2.5 h-2.5" /> {analyzingPostId === result.id ? 'Analizando...' : 'Analizar con IA'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-12 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
              <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Buscar hilos de Reddit por palabras clave
              </h3>
              <p className="text-[#8a8377] font-mono text-[10px] leading-relaxed">
                Busca en varios subreddits a la vez. Deja subreddits vacío para buscar en todo Reddit. Palabras clave por defecto están alineadas a servicios de Ferova.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-mono text-[#8a8377] uppercase">Palabras clave (separadas por coma)</label>
                  <input
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    placeholder="SEO, GEO, ecommerce"
                    className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-[#8a8377] uppercase">Subreddits (opcional, separados por coma)</label>
                  <input
                    value={kwSubs}
                    onChange={(e) => setKwSubs(e.target.value)}
                    placeholder="SEO, digitalmarketing, ecommerce"
                    className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <select value={kwSort} onChange={(e) => setKwSort(e.target.value as any)} className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900">
                  <option value="new">Nuevos</option>
                  <option value="relevance">Relevancia</option>
                  <option value="hot">Hot</option>
                  <option value="top">Top</option>
                  <option value="comments">Más comentarios</option>
                </select>
                <select value={kwTimeframe} onChange={(e) => setKwTimeframe(e.target.value as any)} className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900">
                  <option value="day">Último día</option>
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                  <option value="year">Año</option>
                  <option value="all">Siempre</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={kwLimit}
                  onChange={(e) => setKwLimit(Math.max(1, Math.min(50, Number(e.target.value) || 20)))}
                  className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                />
                <button
                  onClick={handleSearchRedditKw}
                  disabled={searchingKw}
                  className="bg-[#a8c98a] hover:bg-[#96b579] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Search className={`w-3.5 h-3.5 ${searchingKw ? 'animate-pulse' : ''}`} /> {searchingKw ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              {kwPosts.length > 0 && (
                <div className="pt-2 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[520px] overflow-y-auto">
                  <p className="md:col-span-2 text-[9px] font-mono uppercase text-[#8a8377]">{kwPosts.length} resultados</p>
                  {kwPosts.map((p) => (
                    <div key={p.id} className="bg-slate-50/50 border border-slate-200 rounded p-3 space-y-1.5">
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-slate-900 hover:text-blue-600 font-semibold text-[11px] leading-snug block">
                        {p.title}
                      </a>
                      <div className="flex items-center gap-3 text-[9px] font-mono text-[#8a8377] flex-wrap">
                        <span className="text-blue-600">r/{p.subreddit}</span>
                        <span>u/{p.author}</span>
                        <span>▲ {p.score}</span>
                        <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" /> {p.num_comments}</span>
                      </div>
                      {p.selftext && <p className="text-[10px] text-slate-500 line-clamp-3">{p.selftext.slice(0, 220)}{p.selftext.length > 220 ? '…' : ''}</p>}
                      <button
                        onClick={() => handleAnalyzeRedditPost(p)}
                        disabled={analyzingPostId === p.id}
                        className="w-full mt-1 px-2 py-1 bg-blue-50 border border-[#c9a961]/40 text-blue-600 rounded text-[10px] font-mono flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        <Sparkles className="w-2.5 h-2.5" /> {analyzingPostId === p.id ? 'Analizando...' : 'Analizar con IA'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleAnalyzeContenido} className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Analizar publicación
              </h3>
              <p className="text-[#8a8377] font-mono text-[10px] leading-relaxed">
                Pegá el link y el texto de una publicación de LinkedIn o Reddit. La IA la puntúa (0-100), explica por qué y redacta un comentario sugerido para que lo publiques manualmente.
              </p>
              <div className="flex gap-2">
                <select
                  value={anaPlataforma}
                  onChange={(e) => setAnaPlataforma(e.target.value as 'linkedin' | 'reddit')}
                  className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="reddit">Reddit</option>
                </select>
                <input
                  value={anaAutor}
                  onChange={(e) => setAnaAutor(e.target.value)}
                  placeholder="Autor (opcional)"
                  className="flex-1 bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                />
              </div>
              <input
                value={anaUrl}
                onChange={(e) => setAnaUrl(e.target.value)}
                placeholder="URL de la publicación"
                required
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
              />
              <textarea
                value={anaTexto}
                onChange={(e) => setAnaTexto(e.target.value)}
                rows={8}
                placeholder="Pegá acá el texto completo de la publicación..."
                required
                className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900 font-mono text-[11px] leading-relaxed"
              />
              <button
                type="submit"
                disabled={analyzing}
                className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" /> {analyzing ? 'Analizando con IA...' : 'Analizar y guardar'}
              </button>
            </form>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Traer hilos de un subreddit
              </h3>
              <p className="text-[#8a8377] font-mono text-[10px] leading-relaxed">
                Escribe el nombre de una comunidad (ej. <span className="text-blue-600">SEO</span>, <span className="text-blue-600">digitalmarketing</span>, <span className="text-blue-600">emprendedores</span>). Traemos los hilos más recientes/populares y podés analizar cualquiera con un click.
              </p>
              <div className="flex gap-2">
                <span className="bg-slate-50/50 border border-r-0 border-slate-200 p-2 rounded-l text-[#8a8377] font-mono">r/</span>
                <input
                  value={subInput}
                  onChange={(e) => setSubInput(e.target.value)}
                  placeholder="SEO"
                  className="flex-1 bg-slate-50/50 border border-slate-200 border-l-0 p-2 rounded-r text-slate-900 font-mono"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={subListing}
                  onChange={(e) => setSubListing(e.target.value as any)}
                  className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
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
                    className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                  >
                    <option value="day">Hoy</option>
                    <option value="week">Semana</option>
                    <option value="month">Mes</option>
                    <option value="year">Año</option>
                    <option value="all">Siempre</option>
                  </select>
                ) : (
                  <div className="bg-slate-50/20 border border-dashed border-slate-200 p-2 rounded text-[#8a8377] font-mono text-[10px] text-center">—</div>
                )}
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={subLimit}
                  onChange={(e) => setSubLimit(Math.max(1, Math.min(50, Number(e.target.value) || 15)))}
                  className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
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
                <div className="pt-2 border-t border-slate-200 space-y-2 max-h-[520px] overflow-y-auto">
                  <p className="text-[9px] font-mono uppercase text-[#8a8377]">{subPosts.length} hilos · r/{subPosts[0]?.subreddit}</p>
                  {subPosts.map((p) => (
                    <div key={p.id} className="bg-slate-50/50 border border-slate-200 rounded p-3 space-y-1.5">
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-slate-900 hover:text-blue-600 font-semibold text-[11px] leading-snug block">
                        {p.title}
                      </a>
                      <div className="flex items-center gap-3 text-[9px] font-mono text-[#8a8377] flex-wrap">
                        <span>u/{p.author}</span>
                        <span>▲ {p.score}</span>
                        <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" /> {p.num_comments}</span>
                        <span>{Math.round(p.upvote_ratio * 100)}% ↑</span>
                        {p.link_flair_text && <span className="bg-[#c9a961]/10 text-blue-600 px-1.5 rounded">{p.link_flair_text}</span>}
                        {!p.is_self && <span className="text-red-600">link externo</span>}
                      </div>
                      {p.selftext && <p className="text-[10px] text-slate-500 line-clamp-3">{p.selftext.slice(0, 260)}{p.selftext.length > 260 ? '…' : ''}</p>}
                      <button
                        onClick={() => handleAnalyzeRedditPost(p)}
                        disabled={analyzingPostId === p.id}
                        className="w-full mt-1 px-2 py-1 bg-blue-50 border border-[#c9a961]/40 text-blue-600 rounded text-[10px] font-mono flex items-center justify-center gap-1 disabled:opacity-40"
                      >
                        <Sparkles className="w-2.5 h-2.5" /> {analyzingPostId === p.id ? 'Analizando...' : 'Analizar con IA'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-12 space-y-2">
              <h3 className="text-slate-500 font-mono uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200 pb-2">
                Historial analizado ({contenido.length})
              </h3>
              {contenido.length === 0 && !loading && (
                <p className="text-[#8a8377] text-xs font-mono text-center py-10">
                  Sin contenido analizado todavía. Busca en LinkedIn/Reddit y analiza los resultados que tengan potencial.
                </p>
              )}
              {contenido.map((c) => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <a href={c.url_publicacion} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1 font-semibold">
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
                  {c.resumen && <p className="text-slate-500">{c.resumen}</p>}
                  {c.razon && <p className="text-[#8a8377] italic text-[11px]">Por qué: {c.razon}</p>}
                  {c.comentario_sugerido && (
                    <div className="bg-slate-50/50 border border-slate-200 rounded p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono uppercase text-[#8a8377]">Comentario sugerido:</span>
                        <button
                          onClick={() => copyToClipboard(c.comentario_sugerido || '')}
                          className="text-[9px] font-mono text-blue-600 hover:text-[#e8c481] uppercase"
                        >
                          Copiar
                        </button>
                      </div>
                      <p className="text-slate-900">{c.comentario_sugerido}</p>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleMarkContenido(c, 'publicado_manual')}
                      className="px-2.5 py-1 bg-[#a8c98a]/15 border border-[#a8c98a]/40 text-emerald-600 rounded text-[10px] font-mono"
                    >
                      Ya lo publiqué
                    </button>
                    <button
                      onClick={() => handleMarkContenido(c, 'descartado')}
                      className="px-2.5 py-1 bg-white/[0.03] border border-slate-200 text-[#8a8377] rounded text-[10px] font-mono"
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
              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" /> Estado del bot
                  </h3>
                  <button
                    onClick={handleToggleBot}
                    className={`px-3 py-1 rounded font-mono text-[10px] font-bold uppercase ${
                      botConfig.bot_enabled
                        ? 'bg-[#a8c98a]/15 text-emerald-600 border border-[#a8c98a]/40'
                        : 'bg-white/[0.03] text-[#8a8377] border border-slate-200'
                    }`}
                  >
                    {botConfig.bot_enabled ? 'Activo' : 'Apagado'}
                  </button>
                </div>
                <p className="text-[#8a8377] leading-relaxed">
                  Instancia de WhatsApp: <span className="text-slate-500 font-mono">{botConfig.instance_name}</span>. También puedes
                  escribir "activar bot" / "apagar bot" desde el propio WhatsApp para controlarlo.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 space-y-2 text-xs text-slate-700">
                <h3 className="text-blue-700 font-semibold flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Conectar WhatsApp con QR automático
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Cada cuenta tiene una instancia separada. Genera el QR aquí, escanéalo desde WhatsApp y el bot empezará a registrar prospectos, oportunidades, conversaciones y memoria.
                </p>
                <button
                  onClick={handleConnectWhatsapp}
                  disabled={connectingWhatsapp}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${connectingWhatsapp ? 'animate-spin' : ''}`} />
                  {connectingWhatsapp ? 'Generando QR...' : qrSrc ? 'Actualizar QR' : 'Generar QR de conexión'}
                </button>
                {qrSrc && (
                  <div className="rounded-2xl bg-white border border-blue-100 p-4 text-center space-y-2">
                    <img src={qrSrc} alt="QR para conectar WhatsApp" className="mx-auto h-48 w-48 rounded-xl border border-slate-200 object-contain" />
                    <p className="text-[10px] font-mono text-slate-500">Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo.</p>
                  </div>
                )}
                {whatsappInstance && (
                  <div className="rounded-xl bg-white/70 border border-blue-100 p-3 text-[10px] font-mono text-slate-600 space-y-1">
                    <p>Instancia: <span className="text-slate-900 break-all">{whatsappInstance.instance_name}</span></p>
                    <p>Estado: <span className="text-blue-700">{whatsappInstance.status}</span></p>
                    {whatsappInstance.last_error && <p className="text-red-600 break-words">{whatsappInstance.last_error}</p>}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
                <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold">Prompt del bot</h3>
                <textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  rows={6}
                  placeholder="Eres el asistente de ventas de Ferova Agency..."
                  className="w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded text-slate-900"
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
              <form onSubmit={handleAddKnowledge} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
                <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold">Entrenar con nueva información</h3>
                <textarea
                  value={newKnowledge}
                  onChange={(e) => setNewKnowledge(e.target.value)}
                  rows={3}
                  placeholder="Ej: Nuestros precios son... / Horario de atención... / Política de reembolsos..."
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded text-slate-900"
                />
                <input
                  value={newKnowledgeSource}
                  onChange={(e) => setNewKnowledgeSource(e.target.value)}
                  placeholder="Fuente (opcional, ej. 'Página de precios')"
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
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
                  <div key={k.id} className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-3 text-xs">
                    <div className="flex-1">
                      <p className="text-slate-900">{k.content}</p>
                      {k.source && <span className="text-[#8a8377] font-mono text-[10px] block mt-1">Fuente: {k.source}</span>}
                    </div>
                    <button onClick={() => handleDeleteKnowledge(k.id)} className="text-red-600 hover:text-[#e08970] shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'resenas' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[240px]">
                <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5" /> Panel consolidado de reseñas
                </h3>
                <p className="text-[10px] text-[#8a8377] font-mono mt-1 leading-relaxed">
                  Escanea Gmail con las fuentes configuradas y detecta reseñas nuevas. La IA extrae plataforma, calificación, texto y link para responder manualmente.
                </p>
              </div>
              <button
                onClick={handleScanResenas}
                disabled={scanningResenas}
                className="bg-[#c9a961] hover:bg-[#b09252] text-black font-bold px-4 py-2 rounded text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {scanningResenas ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {scanningResenas ? 'Escaneando...' : 'Buscar reseñas nuevas'}
              </button>
              </div>

              <form onSubmit={handleAddReviewSource} className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
                <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Fuentes y perfiles de reseñas
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sourcePlatform}
                    onChange={(e) => {
                      setSourcePlatform(e.target.value);
                      if (!sourceName.trim()) setSourceName(e.target.value);
                    }}
                    className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                  >
                    <option value="google">Google</option>
                    <option value="clutch">Clutch</option>
                    <option value="sortlist">Sortlist</option>
                    <option value="goodfirms">GoodFirms</option>
                    <option value="trustpilot">Trustpilot</option>
                    <option value="designrush">DesignRush</option>
                    <option value="otro">Otro</option>
                  </select>
                  <input
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="Nombre visible"
                    required
                    className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                  />
                </div>
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="Link del perfil/directorio donde respondes reseñas"
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900 font-mono"
                />
                <input
                  value={sourceQuery}
                  onChange={(e) => setSourceQuery(e.target.value)}
                  placeholder="Filtro Gmail opcional: from:... OR subject:review"
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900 font-mono"
                />
                <button
                  type="submit"
                  disabled={savingSource}
                  className="w-full bg-[#a8c98a] hover:bg-[#96b579] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" /> {savingSource ? 'Guardando...' : 'Guardar fuente'}
                </button>
              </form>
            </div>

            {reviewSources.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                {reviewSources.map((source) => (
                  <div key={source.id} className="bg-slate-50/50 border border-slate-200 rounded p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase font-mono text-blue-600">{source.plataforma}</span>
                      <span className="text-slate-900 font-semibold truncate">{source.nombre}</span>
                      <button onClick={() => handleDeleteReviewSource(source.id)} className="ml-auto text-red-600 hover:text-[#e08970]">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <a href={source.profile_url} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-emerald-600 hover:text-blue-600 flex items-center gap-1 truncate">
                      <ExternalLink className="w-3 h-3" /> Abrir perfil
                    </a>
                    {source.gmail_query && <p className="text-[9px] font-mono text-[#8a8377] truncate">{source.gmail_query}</p>}
                  </div>
                ))}
              </div>
            )}
            {scanResult && (
              <p className="text-[11px] text-emerald-600 font-mono bg-[#a8c98a]/5 border border-[#a8c98a]/30 rounded p-2">{scanResult}</p>
            )}

            <div className="space-y-2">
              {resenas.length === 0 && !loading && (
                <p className="text-[#8a8377] text-xs font-mono text-center py-10">Sin reseñas detectadas todavía. Toca "Buscar reseñas nuevas".</p>
              )}
              {resenas.map((r) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="uppercase font-mono text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-[#c9a961]/40">
                      {r.plataforma}
                    </span>
                    {r.calificacion != null && (
                      <span className="font-mono text-[10px] text-[#e8c481] flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-[#e8c481]" /> {r.calificacion}/5
                      </span>
                    )}
                    {r.resenador && <span className="text-slate-500 font-mono text-[10px]">por {r.resenador}</span>}
                    <span className="text-[#8a8377] font-mono text-[10px] ml-auto">{new Date(r.detectada_en).toLocaleString('es-CO')}</span>
                    <span className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase border ${r.respondida ? 'bg-[#a8c98a]/15 text-emerald-600 border-[#a8c98a]/40' : 'bg-[#c97a61]/15 text-red-600 border-[#c97a61]/40'}`}>
                      {r.respondida ? 'Respondida' : 'Sin responder'}
                    </span>
                  </div>
                  {r.texto && <p className="text-slate-900 leading-relaxed whitespace-pre-wrap">{r.texto}</p>}
                  {r.email_subject && <p className="text-[#8a8377] font-mono text-[10px]">✉ {r.email_subject}</p>}
                  <div className="flex items-center gap-3 pt-1">
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1 font-mono text-[10px] hover:text-[#e8c481]">
                        <ExternalLink className="w-3 h-3" /> Responder en {r.plataforma}
                      </a>
                    )}
                    <button
                      onClick={() => handleToggleRespondida(r)}
                      className={`ml-auto text-[10px] font-mono px-2 py-1 rounded border flex items-center gap-1 ${r.respondida ? 'text-red-600 border-[#c97a61]/40 hover:bg-[#c97a61]/10' : 'text-emerald-600 border-[#a8c98a]/40 hover:bg-[#a8c98a]/10'}`}
                    >
                      <CheckCircle2 className="w-3 h-3" /> {r.respondida ? 'Marcar como sin responder' : 'Ya respondí'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function PlaybookCard({ label, text, onCopy, accent }: { label: string; text: string; onCopy: (t: string) => void; accent: string }) {
  return (
    <div className="bg-slate-50/70 border rounded p-3" style={{ borderColor: `${accent}44` }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-mono uppercase tracking-wider font-bold" style={{ color: accent }}>{label}</span>
        <button
          onClick={() => onCopy(text)}
          className="text-[9px] font-mono uppercase flex items-center gap-1 hover:opacity-80"
          style={{ color: accent }}
        >
          <Copy className="w-2.5 h-2.5" /> Copiar
        </button>
      </div>
      <p className="text-slate-900 text-[11px] whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  );
}

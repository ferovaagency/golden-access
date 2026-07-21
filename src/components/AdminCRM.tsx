import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { Loader2, LogOut, Ban, Plus, ExternalLink, Trash2, Send, Bot, CalendarPlus, XCircle, Sparkles, Download, MessageSquare, Zap, Copy, Search, Star, RefreshCw, CheckCircle2, Link2, Bell } from 'lucide-react';
import { getAccessToken, linkGoogleIdentity, logout, saveGoogleLinkReturnTab } from '../lib/supabase';
import { copyText } from '../lib/clipboard';
import { PIPELINE_STAGES } from './crm/constants';
import { PlaybookCard } from './crm/PlaybookCard';
import AdminFeedbackPanel from './AdminFeedbackPanel';
import AdminDeepAnalytics from './AdminDeepAnalytics';
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
  assistWhatsappBot,
  sendWhatsapp,
  bookCita,
  cancelCita,
  syncBookingLinkCitas,
  previewBookingLinkCitas,
  BookingCandidate,
  analyzeContenido,
  listServiciosCatalogo,
  fetchSubredditPosts,
  searchRedditByKeywords,
  searchLinkedInByKeywords,
  enrichOportunidadApollo,
  importApolloList,
  ApolloImportResult,
  scanSortlistLeads,
  ServicioCatalogo,
  EstadoOportunidad,
  Oportunidad,
  CitaDiagnostico,
  ContenidoPotencial,
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
  getMyNotificationPhone,
  setMyNotificationPhone,
  listAcquisitionChannels,
  createAcquisitionChannel,
  updateAcquisitionChannel,
  AcquisitionChannel,
} from '../lib/crmService';
import {
  AdminCustomer,
  FeedbackItem,
  getMyTeamRole,
  listCustomers,
  setCustomerPlan,
  revokeCustomerAccess,
  grantCourtesyAccess,
  listFeedback,
  updateFeedbackStatus,
} from '../lib/adminService';
import type { PlanId } from '../lib/planService';
import { useToast, errMsg } from './ui/toast';

const ESTADOS: EstadoOportunidad[] = ['nuevo', 'contactado', 'calificando', 'propuesta_enviada', 'negociacion', 'ganado', 'perdido'];

export type CRMTab = 'pipeline' | 'citas' | 'contenido' | 'bot' | 'resenas' | 'clientes' | 'feedback' | 'analitica';

interface Props {
  user: User;
  embedded?: boolean;
  tab?: CRMTab;
  onTabChange?: (t: CRMTab) => void;
}

export default function AdminCRM({ user, embedded = false, tab: controlledTab, onTabChange }: Props) {
  const { success: toastOk, error: toastErr, confirm: askConfirm } = useToast();
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
  const [channels, setChannels] = useState<AcquisitionChannel[]>([]);
  const [newChannel, setNewChannel] = useState('');
  const [newVendedor, setNewVendedor] = useState('');
  const [newCommissionPercent, setNewCommissionPercent] = useState('');

  const [promptDraft, setPromptDraft] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [assistingPrompt, setAssistingPrompt] = useState(false);
  const [newKnowledge, setNewKnowledge] = useState('');
  const [newKnowledgeSource, setNewKnowledgeSource] = useState('');
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [assistingKnowledge, setAssistingKnowledge] = useState(false);

  const [whatsappDrafts, setWhatsappDrafts] = useState<Record<string, string>>({});
  const [sendingWhatsapp, setSendingWhatsapp] = useState<string | null>(null);
  const [whatsappInstance, setWhatsappInstance] = useState<WhatsappInstance | null>(null);
  const [whatsappQrSrc, setWhatsappQrSrc] = useState<string | null>(null);
  const [whatsappQrError, setWhatsappQrError] = useState<string | null>(null);
  const [connectingWhatsapp, setConnectingWhatsapp] = useState(false);
  const [notifyPhoneInput, setNotifyPhoneInput] = useState('');
  const [notifyPhoneSaved, setNotifyPhoneSaved] = useState<string | null>(null);
  const [savingNotifyPhone, setSavingNotifyPhone] = useState(false);

  // Portal de administración: clientes (planes/suscripción), cortesía, feedback
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [savingPlanFor, setSavingPlanFor] = useState<string | null>(null);
  const [courtesyEmail, setCourtesyEmail] = useState('');
  const [courtesyPlan, setCourtesyPlan] = useState<PlanId>('completo');
  const [courtesyNotas, setCourtesyNotas] = useState('');
  const [grantingCourtesy, setGrantingCourtesy] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [feedbackFilter, setFeedbackFilter] = useState<'todos' | FeedbackItem['estado']>('nuevo');
  const [clientesLoaded, setClientesLoaded] = useState(false);

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
  const [bookingCandidates, setBookingCandidates] = useState<BookingCandidate[] | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());
  const [importingCandidates, setImportingCandidates] = useState(false);
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
  const [liTimeframe, setLiTimeframe] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [liResults, setLiResults] = useState<LinkedInSearchResult[]>([]);
  const [searchingLi, setSearchingLi] = useState(false);
  const [liWarning, setLiWarning] = useState<string | null>(null);
  const [kwWarning, setKwWarning] = useState<string | null>(null);

  // Apollo + playbook por oportunidad
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [expandedPlaybookId, setExpandedPlaybookId] = useState<string | null>(null);
  const [apolloTitles, setApolloTitles] = useState('');
  const [apolloKeywords, setApolloKeywords] = useState('');
  const [apolloDomains, setApolloDomains] = useState('');
  const [apolloLocations, setApolloLocations] = useState('');
  const [apolloMaxResults, setApolloMaxResults] = useState(25);
  const [importingApollo, setImportingApollo] = useState(false);
  const [apolloImportResult, setApolloImportResult] = useState<ApolloImportResult | null>(null);
  const [scanningSortlistLeads, setScanningSortlistLeads] = useState(false);
  const [sortlistLeadsResult, setSortlistLeadsResult] = useState<string | null>(null);
  const [enrichInputs, setEnrichInputs] = useState<Record<string, { linkedin_url: string; dominio: string; contexto: string }>>({});
  const getEnrichInput = (id: string) => enrichInputs[id] || { linkedin_url: '', dominio: '', contexto: '' };
  const setEnrichInput = (id: string, patch: Partial<{ linkedin_url: string; dominio: string; contexto: string }>) =>
    setEnrichInputs({ ...enrichInputs, [id]: { ...getEnrichInput(id), ...patch } });

  // Auto-enriquecimiento con Apollo tras analizar contenido calificado
  const APOLLO_AUTO_THRESHOLD = 60;
  const [autoEnriching, setAutoEnriching] = useState(false);
  const [autoEnrichNotice, setAutoEnrichNotice] = useState<string | null>(null);

  const looksLikeRealName = (autor: string | null | undefined): boolean => {
    if (!autor) return false;
    const a = autor.trim();
    if (!a) return false;
    // Descarta handles tipo "u/usuario · r/subreddit" — no son nombres reales, Apollo no los puede enriquecer.
    if (/^u\//i.test(a)) return false;
    return true;
  };

  // Si el análisis detectó una oportunidad calificada (score alto) y tenemos un
  // nombre de autor usable, dispara automáticamente el enriquecimiento con Apollo
  // + generación de playbook, en vez de dejarlo como un paso manual separado.
  const maybeAutoEnrichApollo = async (opts: {
    plataforma: 'linkedin' | 'reddit';
    url: string;
    autor: string | null | undefined;
    texto: string;
    score: number | null;
  }) => {
    if (opts.score === null || opts.score < APOLLO_AUTO_THRESHOLD) return;
    if (!looksLikeRealName(opts.autor)) {
      setAutoEnrichNotice('Score alto, pero no hay un nombre de contacto identificable para enriquecer con Apollo automáticamente. Créalo manualmente en el Pipeline si tienes más datos.');
      return;
    }
    setAutoEnriching(true);
    setAutoEnrichNotice(null);
    try {
      const updated = await enrichOportunidadApollo({
        nombre_contacto: opts.autor!.trim(),
        linkedin_url: opts.plataforma === 'linkedin' ? opts.url : undefined,
        fuente_url: opts.url,
        canal_origen: opts.plataforma,
        contexto_publicacion: opts.texto,
        score_potencial: opts.score ?? undefined,
      });
      setOportunidades((prev) => [updated, ...prev.filter((x) => x.id !== updated.id)]);
      setExpandedPlaybookId(updated.id);
      setAutoEnrichNotice(`✓ "${updated.nombre_contacto}" enriquecido con Apollo y playbook generado — revísalo en la pestaña Pipeline.`);
    } catch (err: any) {
      setAutoEnrichNotice(`No se pudo enriquecer automáticamente con Apollo: ${errMsg(err)}`);
    } finally {
      setAutoEnriching(false);
    }
  };

  useEffect(() => {
    (async () => {
      const ok = await isTeamMember(user.email || '');
      setAuthorized(ok);
      if (ok) {
        await refreshAll();
        setTeamRole(await getMyTeamRole(user.email || ''));
      }
    })();
  }, [user.email]);

  const refreshClientesTab = async () => {
    setLoadingCustomers(true);
    try {
      const [c, f] = await Promise.all([listCustomers(), listFeedback()]);
      setCustomers(c);
      setFeedbackList(f);
    } catch (err: any) {
      toastErr(`Error cargando el portal de clientes: ${errMsg(err)}`);
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    if (tab === 'clientes' && authorized && !clientesLoaded) {
      setClientesLoaded(true);
      refreshClientesTab();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authorized]);

  const refreshAll = async () => {
    setLoading(true);
    try {
      const [o, c, k, bc, kn, srv, r, rs, wi, notifyPhone, acquisitionChannels] = await Promise.all([
        listOportunidades(),
        listCitas(),
        listContenidoPotencial(),
        getBotConfig(),
        listKnowledge(),
        listServiciosCatalogo(user.id).catch(() => [] as ServicioCatalogo[]),
        listResenas().catch(() => [] as Resena[]),
        listReviewSources().catch(() => [] as ReviewSource[]),
        getWhatsappInstance().catch(() => null),
        getMyNotificationPhone(user.email || '').catch(() => null),
        listAcquisitionChannels().catch(() => [] as AcquisitionChannel[]),
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
      setNotifyPhoneSaved(notifyPhone);
      setNotifyPhoneInput(notifyPhone || '');
      setChannels(acquisitionChannels);
    } catch (err: any) {
      toastErr(`Error cargando el CRM: ${errMsg(err)}`);
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
      toastErr(`Error activando/desactivando el bot: ${errMsg(err)}`);
    }
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      const updated = await saveBotConfig({ custom_prompt: promptDraft });
      setBotConfig(updated);
    } catch (err: any) {
      toastErr(`Error guardando el prompt: ${errMsg(err)}`);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleAssistPrompt = async () => {
    if (!promptDraft.trim()) { toastErr('Escribe una idea del prompt antes de mejorarla con IA.'); return; }
    setAssistingPrompt(true);
    try {
      setPromptDraft(await assistWhatsappBot('prompt', promptDraft.trim()));
    } catch (err: any) {
      toastErr(`Error mejorando el prompt: ${errMsg(err)}`);
    } finally {
      setAssistingPrompt(false);
    }
  };

  const handleAssistKnowledge = async () => {
    if (!newKnowledge.trim()) { toastErr('Escribe una idea antes de mejorarla con IA.'); return; }
    setAssistingKnowledge(true);
    try {
      setNewKnowledge(await assistWhatsappBot('knowledge', newKnowledge.trim()));
    } catch (err: any) {
      toastErr(`Error mejorando el texto: ${errMsg(err)}`);
    } finally {
      setAssistingKnowledge(false);
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
      toastErr(`Error entrenando al bot: ${errMsg(err)}`);
    } finally {
      setSavingKnowledge(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      await deleteKnowledge(id);
      setKnowledge(knowledge.filter((k) => k.id !== id));
    } catch (err: any) {
      toastErr(`Error eliminando: ${errMsg(err)}`);
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
      toastErr(`Error enviando WhatsApp: ${errMsg(err)}`);
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
      toastErr(`Error agendando la cita: ${errMsg(err)}`);
    } finally {
      setBooking(false);
    }
  };

  const handleCancelCita = async (id: string) => {
    if (!(await askConfirm({ description: '¿Cancelar esta cita y eliminarla del calendario?', destructive: true, confirmText: 'Sí, continuar' }))) return;
    setCancellingId(id);
    try {
      const updated = await cancelCita(id);
      setCitas(citas.map((c) => (c.id === id ? updated : c)));
    } catch (err: any) {
      toastErr(`Error cancelando: ${errMsg(err)}`);
    } finally {
      setCancellingId(null);
    }
  };

  const handleSyncBookingLink = async () => {
    setSyncingBookings(true);
    setBookingCandidates(null);
    try {
      const { scanned, candidates } = await previewBookingLinkCitas(30);
      setBookingCandidates(candidates);
      setSelectedCandidateIds(new Set(candidates.map((c) => c.event_id)));
      if (candidates.length === 0) toastOk(`Reservas revisadas: ${scanned}. No hay reservas nuevas para importar.`);
    } catch (err: any) {
      toastErr(`Error buscando reservas: ${errMsg(err)}`);
    } finally {
      setSyncingBookings(false);
    }
  };

  const toggleCandidateSelection = (eventId: string) => {
    setSelectedCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId); else next.add(eventId);
      return next;
    });
  };

  const handleImportSelectedCandidates = async () => {
    if (selectedCandidateIds.size === 0) return;
    setImportingCandidates(true);
    try {
      const result = await syncBookingLinkCitas(30, Array.from(selectedCandidateIds));
      const [freshCitas, freshOpps] = await Promise.all([listCitas(), listOportunidades()]);
      setCitas(freshCitas);
      setOportunidades(freshOpps);
      toastOk(`Importadas ${result.inserted} citas nuevas.`);
      setBookingCandidates(null);
    } catch (err: any) {
      toastErr(`Error importando reservas: ${errMsg(err)}`);
    } finally {
      setImportingCandidates(false);
    }
  };

  const handleConnectWhatsapp = async () => {
    setConnectingWhatsapp(true);
    setWhatsappQrError(null);
    try {
      const instance = await connectWhatsappInstance();
      setWhatsappInstance(instance);
    } catch (err: any) {
      toastErr(`Error generando QR: ${errMsg(err)}`);
    } finally {
      setConnectingWhatsapp(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const value = whatsappInstance?.qr_code?.trim();
    setWhatsappQrError(null);

    if (!value) {
      setWhatsappQrSrc(null);
      return;
    }

    if (value.startsWith('data:image/')) {
      setWhatsappQrSrc(value);
      return;
    }

    const compact = value.replace(/\s/g, '');
    const looksLikeImageBase64 = /^(iVBORw0KGgo|\/9j\/|R0lGODlh|R0lGODdh|PHN2Zy)/.test(compact);
    if (looksLikeImageBase64) {
      setWhatsappQrSrc(`data:image/png;base64,${compact}`);
      return;
    }

    QRCode.toDataURL(value, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then((src) => {
        if (!cancelled) setWhatsappQrSrc(src);
      })
      .catch(() => {
        if (!cancelled) {
          setWhatsappQrSrc(null);
          setWhatsappQrError('El servidor devolvió el código de conexión, pero no pude convertirlo en QR visible. Pulsa “Actualizar QR”.');
        }
      });

    return () => { cancelled = true; };
  }, [whatsappInstance?.qr_code]);

  const handleSaveNotifyPhone = async () => {
    setSavingNotifyPhone(true);
    try {
      const saved = await setMyNotificationPhone(notifyPhoneInput.trim());
      setNotifyPhoneSaved(saved);
      setNotifyPhoneInput(saved || '');
    } catch (err: any) {
      toastErr(`Error guardando el teléfono de notificaciones: ${errMsg(err)}`);
    } finally {
      setSavingNotifyPhone(false);
    }
  };

  const handleSetPlan = async (customer: AdminCustomer, newPlan: PlanId) => {
    setSavingPlanFor(customer.user_id);
    try {
      await setCustomerPlan(customer.user_id, newPlan);
      setCustomers((prev) => prev.map((c) => (c.user_id === customer.user_id ? { ...c, plan: newPlan } : c)));
    } catch (err: any) {
      toastErr(`Error cambiando el plan: ${errMsg(err)}`);
    } finally {
      setSavingPlanFor(null);
    }
  };

  const handleRevokeAccess = async (customer: AdminCustomer) => {
    if (!(await askConfirm({
      title: 'Revocar acceso',
      description: `Esto cancela el acceso de ${customer.nombre_negocio || customer.email} (${customer.estado_suscripcion === 'cortesia' ? 'cortesía' : 'suscripción activa'}). Sus datos NO se borran y puedes volver a darle acceso después. ¿Continuar?`,
      destructive: true,
      confirmText: 'Sí, revocar',
    }))) return;
    setSavingPlanFor(customer.user_id);
    try {
      await revokeCustomerAccess(customer.user_id);
      setCustomers((prev) => prev.map((c) => (c.user_id === customer.user_id ? { ...c, estado_suscripcion: 'sin_pago' as const } : c)));
      toastOk('Acceso revocado.');
    } catch (err: any) {
      toastErr(`Error revocando el acceso: ${errMsg(err)}`);
    } finally {
      setSavingPlanFor(null);
    }
  };

  const handleGrantCourtesy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courtesyEmail.trim()) return;
    setGrantingCourtesy(true);
    try {
      await grantCourtesyAccess(courtesyEmail.trim().toLowerCase(), courtesyPlan, courtesyNotas.trim() || undefined);
      setCourtesyEmail('');
      setCourtesyNotas('');
      await refreshClientesTab();
      toastOk('Acceso de cortesía otorgado.');
    } catch (err: any) {
      toastErr(`Error dando acceso de cortesía: ${errMsg(err)}`);
    } finally {
      setGrantingCourtesy(false);
    }
  };

  const handleUpdateFeedbackStatus = async (item: FeedbackItem, estado: FeedbackItem['estado']) => {
    try {
      await updateFeedbackStatus(item.id, estado);
      setFeedbackList((prev) => prev.map((f) => (f.id === item.id ? { ...f, estado } : f)));
    } catch (err: any) {
      toastErr(`Error actualizando el feedback: ${errMsg(err)}`);
    }
  };

  const handleAnalyzeContenido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anaUrl.trim() || anaTexto.trim().length < 30) {
      toastErr('Pega la URL y al menos 30 caracteres del texto de la publicación.');
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
      const { url: capturedUrl, autor: capturedAutor, texto: capturedTexto } = { url: anaUrl.trim(), autor: anaAutor.trim() || null, texto: anaTexto.trim() };
      setAnaUrl(''); setAnaAutor(''); setAnaTexto('');
      await maybeAutoEnrichApollo({ plataforma: anaPlataforma, url: capturedUrl, autor: capturedAutor, texto: capturedTexto, score: created.score_potencial });
    } catch (err: any) {
      toastErr(`Error analizando: ${errMsg(err)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFetchSubreddit = async () => {
    const sub = subInput.trim().replace(/^r\//i, '');
    if (!sub) { toastErr('Escribe el nombre del subreddit (ej. SEO, digitalmarketing, colombia).'); return; }
    setFetchingSub(true);
    try {
      const posts = await fetchSubredditPosts({ subreddit: sub, listing: subListing, limit: subLimit, timeframe: subTimeframe });
      setSubPosts(posts);
    } catch (err: any) {
      toastErr(`Error trayendo r/${sub}: ${errMsg(err)}`);
    } finally {
      setFetchingSub(false);
    }
  };

  const handleAnalyzeRedditPost = async (post: RedditPost) => {
    const texto = `${post.title}\n\n${post.selftext || '(publicación sin texto propio; probable link o imagen)'}`;
    if (texto.length < 30) { toastErr('La publicación es demasiado corta para analizar.'); return; }
    setAnalyzingPostId(post.id);
    try {
      const created = await analyzeContenido({
        plataforma: 'reddit',
        url_publicacion: post.url,
        autor: `u/${post.author} · r/${post.subreddit}`,
        texto,
      });
      setContenido([created, ...contenido]);
      // Los handles de Reddit (u/usuario) no son nombres reales: maybeAutoEnrichApollo
      // los descarta automáticamente y solo avisa si el score era alto.
      await maybeAutoEnrichApollo({ plataforma: 'reddit', url: post.url, autor: `u/${post.author}`, texto, score: created.score_potencial });
    } catch (err: any) {
      toastErr(`Error analizando: ${errMsg(err)}`);
    } finally {
      setAnalyzingPostId(null);
    }
  };

  const handleSearchRedditKw = async () => {
    const keywords = kwInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (keywords.length === 0) { toastErr('Escribe al menos una palabra clave.'); return; }
    const subreddits = kwSubs.split(',').map((s) => s.trim().replace(/^r\//i, '')).filter(Boolean);
    setSearchingKw(true);
    setKwWarning(null);
    try {
      const { posts, warning } = await searchRedditByKeywords({ keywords, subreddits, sort: kwSort, timeframe: kwTimeframe, limit: kwLimit });
      setKwPosts(posts);
      setKwWarning(warning);
    } catch (err: any) {
      toastErr(`Error buscando: ${errMsg(err)}`);
    } finally {
      setSearchingKw(false);
    }
  };

  const handleSearchLinkedIn = async () => {
    const keywords = liInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (keywords.length === 0) { toastErr('Escribe al menos una palabra clave.'); return; }
    setSearchingLi(true);
    setLiWarning(null);
    try {
      const { results, warning } = await searchLinkedInByKeywords({ keywords, limit: liLimit, timeframe: liTimeframe });
      setLiResults(results);
      setLiWarning(warning);
    } catch (err: any) {
      toastErr(`Error buscando en LinkedIn: ${errMsg(err)}`);
    } finally {
      setSearchingLi(false);
    }
  };

  const handleAnalyzeLinkedInResult = async (result: LinkedInSearchResult) => {
    const texto = `${result.title}\n\n${result.snippet}`;
    if (texto.trim().length < 30) { toastErr('El resultado no trae suficiente texto para analizar.'); return; }
    setAnalyzingPostId(result.id);
    try {
      const created = await analyzeContenido({
        plataforma: 'linkedin',
        url_publicacion: result.url,
        autor: result.author || null,
        texto,
      });
      setContenido([created, ...contenido]);
      await maybeAutoEnrichApollo({ plataforma: 'linkedin', url: result.url, autor: result.author, texto, score: created.score_potencial });
    } catch (err: any) {
      toastErr(`Error analizando: ${errMsg(err)}`);
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
      toastErr(`Error enriqueciendo con Apollo: ${errMsg(err)}`);
    } finally {
      setEnrichingId(null);
    }
  };

  const handleImportApollo = async (e: React.FormEvent) => {
    e.preventDefault();
    const titles = apolloTitles.split(',').map((t) => t.trim()).filter(Boolean);
    const domains = apolloDomains.split(',').map((d) => d.trim()).filter(Boolean);
    const locations = apolloLocations.split(',').map((l) => l.trim()).filter(Boolean);
    if (!titles.length && !apolloKeywords.trim() && !domains.length && !locations.length) {
      toastErr('Define al menos un filtro: cargo, palabra clave, dominio o ubicación.');
      return;
    }
    setImportingApollo(true);
    setApolloImportResult(null);
    try {
      const result = await importApolloList({
        titles: titles.length ? titles : undefined,
        keywords: apolloKeywords.trim() || undefined,
        domains: domains.length ? domains : undefined,
        locations: locations.length ? locations : undefined,
        max_results: apolloMaxResults,
      });
      setApolloImportResult(result);
      if (result.oportunidades.length) setOportunidades([...result.oportunidades, ...oportunidades]);
    } catch (err: any) {
      toastErr(`Error importando de Apollo: ${errMsg(err)}`);
    } finally {
      setImportingApollo(false);
    }
  };

  const handleScanSortlistLeads = async () => {
    setScanningSortlistLeads(true);
    setSortlistLeadsResult(null);
    try {
      if (!getAccessToken()) {
        // Necesita scopes de Workspace (Gmail), no solo identidad -- googleSignIn()
        // no los pide y dejaba este flujo sin permiso real tras "reconectar".
        if (embedded) saveGoogleLinkReturnTab(`crm-${tab}`);
        await linkGoogleIdentity();
        return;
      }
      const res = await scanSortlistLeads(30);
      setSortlistLeadsResult(`Escaneados ${res.scanned} correos · ${res.inserted} lead(s) nuevo(s) importados · ${res.already_saved} ya procesados · ${res.skipped} sin lead.`);
      if (res.oportunidades.length) setOportunidades([...res.oportunidades, ...oportunidades]);
    } catch (err: any) {
      toastErr(`Error escaneando leads de Sortlist: ${errMsg(err)}`);
    } finally {
      setScanningSortlistLeads(false);
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
        // Necesita scopes de Workspace (Gmail), no solo identidad -- googleSignIn()
        // no los pide y dejaba este flujo sin permiso real tras "reconectar".
        if (embedded) saveGoogleLinkReturnTab(`crm-${tab}`);
        await linkGoogleIdentity();
        return;
      }
      const res = await scanResenas(30);
      setScanResult(`Escaneados ${res.scanned} correos · ${res.inserted} nuevas reseñas · ${res.already_saved} ya guardadas · ${res.skipped} sin reseña.`);
      setResenas(await listResenas());
      setReviewSources(await listReviewSources());
    } catch (err: any) {
      toastErr(`Error escaneando Gmail: ${errMsg(err)}`);
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
      toastErr(`Error guardando fuente: ${errMsg(err)}`);
    } finally {
      setSavingSource(false);
    }
  };

  const handleDeleteReviewSource = async (id: string) => {
    try {
      await deleteReviewSource(id);
      setReviewSources(reviewSources.filter((s) => s.id !== id));
    } catch (err: any) {
      toastErr(`Error eliminando fuente: ${errMsg(err)}`);
    }
  };

  const handleToggleRespondida = async (r: Resena) => {
    try {
      await markResenaRespondida(r.id, !r.respondida);
      setResenas(resenas.map((x) => (x.id === r.id ? { ...x, respondida: !r.respondida } : x)));
    } catch (err: any) {
      toastErr(`Error actualizando: ${errMsg(err)}`);
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
        vendedor: newVendedor.trim() || null,
        comision_porcentaje: newCommissionPercent ? Number(newCommissionPercent) : null,
        comision_valor: valor != null && newCommissionPercent ? valor * Number(newCommissionPercent) / 100 : null,
      });
      setOportunidades([created, ...oportunidades]);
      setNombreContacto('');
      setEmpresa('');
      setFuenteUrl('');
      setTelefono('');
      setNuevaServicioId('');
      setNuevaValorEstimado('');
      setNewVendedor('');
      setNewCommissionPercent('');
    } catch (err: any) {
      toastErr(`Error creando oportunidad: ${errMsg(err)}`);
    }
  };

  const handleChangeEstado = async (o: Oportunidad, estado: EstadoOportunidad) => {
    try {
      const updated = await upsertOportunidad({ id: o.id, estado });
      setOportunidades(oportunidades.map((x) => (x.id === o.id ? updated : x)));
    } catch (err: any) {
      toastErr(`Error actualizando estado: ${errMsg(err)}`);
    }
  };

  const handleChangeCanal = async (o: Oportunidad, canal_origen: Oportunidad['canal_origen']) => {
    try {
      const updated = await upsertOportunidad({ id: o.id, canal_origen });
      setOportunidades(oportunidades.map((x) => (x.id === o.id ? updated : x)));
    } catch (err: any) {
      toastErr(`Error actualizando canal: ${errMsg(err)}`);
    }
  };

  const handleCommercialUpdate = async (o: Oportunidad, patch: Partial<Pick<Oportunidad, 'vendedor' | 'comision_porcentaje' | 'comision_valor'>>) => {
    try {
      const next = { ...patch };
      if ('comision_porcentaje' in next && o.valor_estimado != null && next.comision_porcentaje != null) next.comision_valor = o.valor_estimado * next.comision_porcentaje / 100;
      const updated = await upsertOportunidad({ id: o.id, ...next });
      setOportunidades((current) => current.map((item) => item.id === o.id ? updated : item));
    } catch (err: any) {
      toastErr(`Error actualizando comisión: ${errMsg(err)}`);
    }
  };

  const handleAddChannel = async () => {
    if (!newChannel.trim()) return;
    try {
      const created = await createAcquisitionChannel(newChannel);
      setChannels((current) => [...current, created].sort((a, b) => a.label.localeCompare(b.label)));
      setNewChannel('');
      setCanalOrigen(created.slug);
    } catch (err: any) {
      toastErr(`Error creando canal: ${errMsg(err)}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await askConfirm({ description: '¿Eliminar esta oportunidad?', destructive: true, confirmText: 'Sí, continuar' }))) return;
    try {
      await deleteOportunidad(id);
      setOportunidades(oportunidades.filter((o) => o.id !== id));
    } catch (err: any) {
      toastErr(`Error eliminando: ${errMsg(err)}`);
    }
  };

  const handleMarkContenido = async (c: ContenidoPotencial, estado: ContenidoPotencial['estado']) => {
    try {
      const updated = await upsertContenidoPotencial({ id: c.id, estado });
      setContenido(contenido.map((x) => (x.id === c.id ? updated : x)));
    } catch (err: any) {
      toastErr(`Error actualizando contenido: ${errMsg(err)}`);
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
            <div className="flex items-center gap-4">
              <a href="/app" className="text-[#8a8377] hover:text-blue-700 flex items-center gap-1 text-xs font-mono">← Volver a Ferova One</a>
              <button onClick={() => logout()} className="text-[#8a8377] hover:text-red-600 flex items-center gap-1 text-xs font-mono">
                <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
              </button>
            </div>
          </header>

          <nav className="flex gap-2 px-6 py-3 border-b border-slate-200 text-xs font-mono">
            {(['pipeline', 'citas', 'contenido', 'bot', 'resenas', 'clientes', 'feedback', 'analitica'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded uppercase tracking-wider font-semibold ${
                  tab === t ? 'bg-blue-50 text-blue-600 border border-[#c9a961]/40' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t === 'pipeline' ? 'Pipeline' : t === 'citas' ? 'Citas de diagnóstico' : t === 'contenido' ? 'Contenido con potencial' : t === 'bot' ? 'Bot de WhatsApp' : t === 'resenas' ? 'Reseñas' : t === 'clientes' ? 'Clientes' : t === 'feedback' ? 'Feedback & Uso' : 'Analítica profunda'}
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
          <div className="space-y-6">
          <form onSubmit={handleImportApollo} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold">
              <Search className="w-3.5 h-3.5" /> Importar lista desde Apollo
            </div>
            <p className="text-[10px] text-slate-400">Busca prospectos en Apollo.io por cargo, palabra clave, dominio o ubicación, y los agrega al pipeline evitando duplicados por email/LinkedIn/nombre+dominio. No genera el playbook automáticamente — eso se hace por oportunidad con "Enriquecer con Apollo".</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Cargos (separados por coma)</label>
                <input value={apolloTitles} onChange={(e) => setApolloTitles(e.target.value)} placeholder="CEO, Director de Marketing" className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900" />
              </div>
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Palabras clave</label>
                <input value={apolloKeywords} onChange={(e) => setApolloKeywords(e.target.value)} placeholder="agencia SEO Colombia" className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900" />
              </div>
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Dominios (separados por coma)</label>
                <input value={apolloDomains} onChange={(e) => setApolloDomains(e.target.value)} placeholder="empresa.com" className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900" />
              </div>
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Ubicaciones (separadas por coma)</label>
                <input value={apolloLocations} onChange={(e) => setApolloLocations(e.target.value)} placeholder="Bogotá, Colombia" className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900" />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Máximo de resultados</label>
                <input type="number" min={1} max={100} value={apolloMaxResults} onChange={(e) => setApolloMaxResults(Math.max(1, Math.min(100, Number(e.target.value) || 25)))} className="w-24 bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900" />
              </div>
              <button type="submit" disabled={importingApollo} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded disabled:opacity-50 flex items-center gap-2">
                {importingApollo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {importingApollo ? 'Importando…' : 'Buscar e importar'}
              </button>
            </div>
            {apolloImportResult && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-[11px] text-blue-800">
                {apolloImportResult.imported} importado(s) de {apolloImportResult.fetched} encontrado(s) ({apolloImportResult.total_found} disponibles en Apollo) · {apolloImportResult.skipped_duplicates} duplicado(s) omitido(s).
              </div>
            )}
          </form>

          <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold">
              <Bell className="w-3.5 h-3.5" /> Leads del Radar de Sortlist
            </div>
            <p className="text-[10px] text-slate-400">Sortlist no tiene API pública para leer el Radar directamente, así que esto escanea las notificaciones de leads nuevos que Sortlist envía por correo a tu Gmail conectado y las importa al pipeline. Requiere Google Workspace conectado con permiso Gmail.</p>
            <button type="button" onClick={handleScanSortlistLeads} disabled={scanningSortlistLeads} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded disabled:opacity-50 flex items-center gap-2">
              {scanningSortlistLeads ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              {scanningSortlistLeads ? 'Escaneando…' : 'Buscar leads nuevos en Gmail'}
            </button>
            {sortlistLeadsResult && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-[11px] text-blue-800">{sortlistLeadsResult}</div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleCreateOportunidad} className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold">Nueva oportunidad</h3>
              <div>
                <label htmlFor="op-nombre" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Nombre de contacto</label>
                <input
                  id="op-nombre"
                  value={nombreContacto}
                  onChange={(e) => setNombreContacto(e.target.value)}
                  placeholder="Nombre de contacto"
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="op-empresa" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Empresa (opcional)</label>
                <input
                  id="op-empresa"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Empresa"
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="op-canal" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Canal de origen</label>
                <select
                  id="op-canal"
                  value={canalOrigen}
                  onChange={(e) => setCanalOrigen(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                >
                  {(channels.length ? channels.filter((channel) => channel.active) : [{ slug: 'linkedin', label: 'LinkedIn' }, { slug: 'otro', label: 'Otro' }]).map((channel) => (
                    <option key={channel.slug} value={channel.slug}>{channel.label}</option>
                  ))}
                </select>
                <div className="mt-2 flex gap-2">
                  <input value={newChannel} onChange={(event) => setNewChannel(event.target.value)} placeholder="Agregar canal…" className="min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-900" />
                  <button type="button" onClick={handleAddChannel} className="rounded border border-blue-200 px-2 py-1 text-[10px] font-semibold text-blue-700">Crear</button>
                </div>
                {channels.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{channels.map((channel) => <button type="button" key={channel.id} onClick={async () => { const updated = await updateAcquisitionChannel(channel.id, { active: !channel.active }); setChannels((current) => current.map((item) => item.id === updated.id ? updated : item)); }} className={`rounded-full border px-2 py-0.5 text-[9px] ${channel.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-400 line-through'}`} title="Activar o desactivar canal">{channel.label}</button>)}</div>}
              </div>
              <div>
                <label htmlFor="op-fuente" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Link de la publicación/perfil (opcional)</label>
                <input
                  id="op-fuente"
                  value={fuenteUrl}
                  onChange={(e) => setFuenteUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="op-telefono" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">WhatsApp (opcional)</label>
                <input
                  id="op-telefono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="573001234567"
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="op-servicio" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Servicio del catálogo (opcional)</label>
                <select
                  id="op-servicio"
                  value={nuevaServicioId}
                  onChange={(e) => setNuevaServicioId(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                >
                  <option value="">Sin servicio asociado</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="op-valor" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Valor estimado (opcional)</label>
                <div className="flex gap-2">
                  <input
                    id="op-valor"
                    type="number"
                    min={0}
                    value={nuevaValorEstimado}
                    onChange={(e) => setNuevaValorEstimado(e.target.value)}
                    placeholder="0"
                    aria-label="Valor estimado"
                    className="flex-1 bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                  />
                  <select
                    value={nuevaMoneda}
                    onChange={(e) => setNuevaMoneda(e.target.value as 'COP' | 'USD')}
                    aria-label="Moneda"
                    className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                  >
                    <option value="COP">COP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Vendedor / comisionista</span><input value={newVendedor} onChange={(event) => setNewVendedor(event.target.value)} placeholder="Nombre" className="w-full rounded border border-slate-200 bg-slate-50/50 p-2 text-slate-900" /></label>
                <label className="block"><span className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Comisión %</span><input type="number" min="0" max="100" step="0.1" value={newCommissionPercent} onChange={(event) => setNewCommissionPercent(event.target.value)} placeholder="0" className="w-full rounded border border-slate-200 bg-slate-50/50 p-2 text-slate-900" /></label>
              </div>
              {Number(nuevaValorEstimado) > 0 && Number(newCommissionPercent) > 0 && <p className="rounded-lg bg-blue-50 px-3 py-2 text-[10px] text-blue-700">Comisión estimada: {new Intl.NumberFormat('es-CO', { style: 'currency', currency: nuevaMoneda, maximumFractionDigits: 0 }).format(Number(nuevaValorEstimado) * Number(newCommissionPercent) / 100)}</p>}
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
                // Clasificación Hot/Warm/Cold (marco del skill de prospecting): Hot >=70,
                // Warm 40-69, Cold <40. Usa `probabilidad`, que se llena sola con el
                // score_potencial del análisis de contenido que originó el lead (si vino
                // de ahí) o manualmente por el equipo.
                const tier = o.probabilidad == null
                  ? null
                  : o.probabilidad >= 70
                    ? { label: 'Hot', color: '#c97a61' }
                    : o.probabilidad >= 40
                      ? { label: 'Warm', color: '#c9a961' }
                      : { label: 'Cold', color: '#8a8377' };
                return (
                  <div key={o.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[160px]">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {o.nombre_contacto}
                          {tier && (
                            <span
                              className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border"
                              style={{ color: tier.color, borderColor: `${tier.color}66` }}
                              title={`Score/probabilidad: ${o.probabilidad}`}
                            >
                              {tier.label}
                            </span>
                          )}
                        </div>
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
                        {PIPELINE_STAGES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <select
                        value={o.canal_origen}
                        onChange={(e) => handleChangeCanal(o, e.target.value as Oportunidad['canal_origen'])}
                        aria-label={`Canal de ${o.nombre_contacto}`}
                        className="bg-slate-50/60 border border-slate-200 rounded px-2 py-1 text-slate-500 font-mono text-[10px]"
                      >
                        {(channels.length ? channels : [{ slug: o.canal_origen, label: o.canal_origen } as AcquisitionChannel]).map((channel) => (
                          <option key={channel.slug} value={channel.slug}>{channel.label}</option>
                        ))}
                      </select>
                      <button onClick={() => handleDelete(o.id)} className="text-red-600 hover:text-[#e08970]">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
                    <label className="text-[9px] font-mono uppercase text-slate-500">Vendedor<input defaultValue={o.vendedor || ''} onBlur={(event) => handleCommercialUpdate(o, { vendedor: event.target.value.trim() || null })} className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs normal-case text-slate-900" /></label>
                    <label className="text-[9px] font-mono uppercase text-slate-500">Comisión %<input type="number" min="0" max="100" step="0.1" defaultValue={o.comision_porcentaje ?? ''} onBlur={(event) => handleCommercialUpdate(o, { comision_porcentaje: event.target.value ? Number(event.target.value) : null })} className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900" /></label>
                    <div className="text-[9px] font-mono uppercase text-slate-500">Comisión calculada<p className="mt-1 text-sm font-bold normal-case text-slate-900">{o.comision_valor != null ? fmt(Number(o.comision_valor), o.moneda || 'COP') : '—'}</p></div>
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
                        {o.apollo_enriched_at ? `Enriquecido con Apollo · ${new Date(o.apollo_enriched_at).toLocaleString('es-CO')}` : 'Enriquecer con Apollo + generar playbook de contacto'}
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
                  {syncingBookings ? 'Buscando reservas...' : 'Buscar reservas nuevas'}
                </button>
                {bookingCandidates && bookingCandidates.length > 0 && (
                  <div className="border border-emerald-200 rounded-lg p-3 space-y-2 bg-emerald-50/40">
                    <p className="text-[9px] text-slate-600 font-mono uppercase tracking-wider">Elige cuáles traer a Citas ({selectedCandidateIds.size}/{bookingCandidates.length})</p>
                    <div className="max-h-56 overflow-y-auto space-y-1.5">
                      {bookingCandidates.map((c) => (
                        <label key={c.event_id} className="flex items-start gap-2 bg-white border border-slate-200 rounded p-2 cursor-pointer">
                          <input type="checkbox" className="mt-0.5" checked={selectedCandidateIds.has(c.event_id)} onChange={() => toggleCandidateSelection(c.event_id)} />
                          <span className="flex-1 min-w-0">
                            <span className="block font-semibold text-slate-900 truncate">{c.nombre}</span>
                            <span className="block text-[9px] text-slate-500 font-mono">
                              {new Date(c.fecha_hora).toLocaleString('es-CO')} · {c.duracion_min} min{c.ya_paso ? ' · ya pasó' : ''}{c.email ? ` · ${c.email}` : ''}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleImportSelectedCandidates} disabled={importingCandidates || selectedCandidateIds.size === 0} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-[11px] disabled:opacity-50">
                        {importingCandidates ? 'Importando...' : `Importar seleccionadas (${selectedCandidateIds.size})`}
                      </button>
                      <button type="button" onClick={() => setBookingCandidates(null)} className="px-3 py-2 rounded border border-slate-200 text-slate-600 text-[11px] font-semibold hover:bg-slate-50">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
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
            {(autoEnriching || autoEnrichNotice) && (
              <div className="lg:col-span-12 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs flex items-center gap-2">
                {autoEnriching ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span className="text-blue-700">Score alto detectado — enriqueciendo con Apollo y preparando el playbook de contacto...</span>
                  </>
                ) : (
                  <span className="text-blue-700">{autoEnrichNotice}</span>
                )}
              </div>
            )}
            <div className="lg:col-span-12 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
              <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Buscar publicaciones públicas de LinkedIn
              </h3>
              <p className="text-[#8a8377] font-mono text-[10px] leading-relaxed">
                Funciona igual que Reddit: busca automáticamente señales públicas relacionadas con servicios de Ferova. Luego eliges qué resultado analizar y guardar.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_130px_90px_150px] gap-2">
                <input
                  value={liInput}
                  onChange={(e) => setLiInput(e.target.value)}
                  placeholder="SEO, Shopify, automatización IA"
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900 font-mono"
                />
                <select value={liTimeframe} onChange={(e) => setLiTimeframe(e.target.value as any)} className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900">
                  <option value="day">Último día</option>
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                  <option value="year">Año</option>
                  <option value="all">Siempre</option>
                </select>
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
              {liWarning && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 leading-relaxed">{liWarning}</p>
              )}
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
                        <Sparkles className="w-2.5 h-2.5" /> {analyzingPostId === result.id ? 'Evaluando...' : 'Evaluar intención'}
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
              {kwWarning && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 leading-relaxed">{kwWarning}</p>
              )}
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
                        <Sparkles className="w-2.5 h-2.5" /> {analyzingPostId === p.id ? 'Evaluando...' : 'Evaluar intención'}
                      </button>
                      <RedditCommentability post={p} />
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
                <div>
                  <label htmlFor="ana-plataforma" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Plataforma</label>
                  <select
                    id="ana-plataforma"
                    value={anaPlataforma}
                    onChange={(e) => setAnaPlataforma(e.target.value as 'linkedin' | 'reddit')}
                    className="bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                  >
                    <option value="linkedin">LinkedIn</option>
                    <option value="reddit">Reddit</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label htmlFor="ana-autor" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Autor (opcional)</label>
                  <input
                    id="ana-autor"
                    value={anaAutor}
                    onChange={(e) => setAnaAutor(e.target.value)}
                    placeholder="Nombre del autor"
                    className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="ana-url" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">URL de la publicación</label>
                <input
                  id="ana-url"
                  value={anaUrl}
                  onChange={(e) => setAnaUrl(e.target.value)}
                  placeholder="https://..."
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="ana-texto" className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Texto de la publicación</label>
                <textarea
                  id="ana-texto"
                  value={anaTexto}
                  onChange={(e) => setAnaTexto(e.target.value)}
                  rows={8}
                  placeholder="Pegá acá el texto completo de la publicación..."
                  required
                  className="w-full bg-slate-50/50 border border-slate-200 p-2 rounded text-slate-900 font-mono text-[11px] leading-relaxed"
                />
              </div>
              <button
                type="submit"
                disabled={analyzing}
                className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" /> {analyzing ? 'Evaluando...' : 'Evaluar y guardar'}
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
                        <Sparkles className="w-2.5 h-2.5" /> {analyzingPostId === p.id ? 'Evaluando...' : 'Evaluar intención'}
                      </button>
                      <RedditCommentability post={p} />
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
                  {connectingWhatsapp ? 'Generando QR...' : whatsappQrSrc ? 'Actualizar QR' : 'Generar QR de conexión'}
                </button>
                {whatsappQrSrc && (
                  <div className="rounded-2xl bg-white border border-blue-100 p-4 text-center space-y-2">
                    <img src={whatsappQrSrc} alt="QR para conectar WhatsApp" className="mx-auto h-48 w-48 rounded-xl border border-slate-200 object-contain" />
                    <p className="text-[10px] font-mono text-slate-500">Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo.</p>
                  </div>
                )}
                {whatsappQrError && (
                  <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-[10px] font-mono text-red-600">
                    {whatsappQrError}
                  </p>
                )}
                {whatsappInstance && (
                  <div className="rounded-xl bg-white/70 border border-blue-100 p-3 text-[10px] font-mono text-slate-600 space-y-1">
                    <p>Instancia: <span className="text-slate-900 break-all">{whatsappInstance.instance_name}</span></p>
                    <p>Estado: <span className="text-blue-700">{whatsappInstance.status}</span></p>
                    {whatsappInstance.last_error && <p className="text-red-600 break-words">{whatsappInstance.last_error}</p>}
                  </div>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-lg p-5 space-y-2 text-xs text-slate-700">
                <h3 className="text-amber-700 font-semibold flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" /> Alerta de leads Hot por WhatsApp
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Si pones tu número aquí, te llega un WhatsApp automático cada vez que el análisis de contenido detecta un lead con score ≥ 70 (Hot) — no tienes que estar revisando el Pipeline.
                </p>
                <label htmlFor="notify-phone" className="block text-[10px] font-mono uppercase tracking-wider text-slate-500">Tu número (solo dígitos, con indicativo)</label>
                <div className="flex gap-2">
                  <input
                    id="notify-phone"
                    value={notifyPhoneInput}
                    onChange={(e) => setNotifyPhoneInput(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="573001234567"
                    className="flex-1 bg-white border border-amber-200 p-2 rounded text-slate-900"
                  />
                  <button
                    onClick={handleSaveNotifyPhone}
                    disabled={savingNotifyPhone}
                    className="rounded-lg bg-amber-600 hover:bg-amber-700 px-4 text-white font-semibold disabled:opacity-50"
                  >
                    {savingNotifyPhone ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
                {notifyPhoneSaved && (
                  <p className="text-[10px] font-mono text-amber-700">✓ Alertas activas a {notifyPhoneSaved}</p>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
                <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold">Prompt del bot</h3>
                <textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  rows={6}
                  placeholder="Ej: quiero que venda paquetes SEO y agende diagnósticos gratis..."
                  className="w-full bg-slate-50/50 border border-slate-200 p-2.5 rounded text-slate-900"
                />
                <p className="text-[10px] text-slate-400">Escribe la idea con tus palabras y usa "Mejorar con IA" para convertirla en un prompt completo antes de guardar.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAssistPrompt}
                    disabled={assistingPrompt}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 border border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold py-2 rounded disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> {assistingPrompt ? 'Mejorando...' : 'Mejorar con IA'}
                  </button>
                  <button
                    onClick={handleSavePrompt}
                    disabled={savingPrompt}
                    className="flex-1 bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded disabled:opacity-50"
                  >
                    {savingPrompt ? 'Guardando...' : 'Guardar prompt'}
                  </button>
                </div>
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
                <button
                  type="button"
                  onClick={handleAssistKnowledge}
                  disabled={assistingKnowledge}
                  className="w-full inline-flex items-center justify-center gap-1.5 border border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold py-2 rounded disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" /> {assistingKnowledge ? 'Mejorando...' : 'Mejorar con IA'}
                </button>
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

        {tab === 'clientes' && (
          <div className="space-y-6">
            {loadingCustomers && (
              <div className="flex items-center gap-2 text-blue-600 text-xs font-mono">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando clientes...
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold">
                Clientes registrados ({customers.length})
              </h3>
              {!loadingCustomers && customers.length === 0 && (
                <p className="text-xs text-[#8a8377]">Todavía no hay clientes registrados.</p>
              )}
              {customers.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[#8a8377] font-mono uppercase text-[9px] tracking-wider border-b border-slate-200">
                        <th className="py-2 pr-3">Negocio / Email</th>
                        <th className="py-2 pr-3">Estado</th>
                        <th className="py-2 pr-3">Plan</th>
                        <th className="py-2 pr-3">Onboarding</th>
                        <th className="py-2 pr-3">Registrado</th>
                        {teamRole === 'owner' && <th className="py-2 pr-3">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((c) => (
                        <tr key={c.user_id} className="border-b border-slate-100">
                          <td className="py-2 pr-3">
                            <div className="text-slate-900 font-semibold">{c.nombre_negocio || '(sin nombre aún)'}</div>
                            <div className="text-[#8a8377] font-mono text-[10px]">{c.email}</div>
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase border ${
                              c.estado_suscripcion === 'activo' ? 'bg-[#a8c98a]/15 text-emerald-600 border-[#a8c98a]/40'
                                : c.estado_suscripcion === 'cortesia' ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : 'bg-[#c97a61]/15 text-red-600 border-[#c97a61]/40'
                            }`}>
                              {c.estado_suscripcion === 'activo' ? 'Activo' : c.estado_suscripcion === 'cortesia' ? 'Cortesía' : 'Sin pago'}
                            </span>
                          </td>
                          <td className="py-2 pr-3">
                            <select
                              value={c.plan}
                              disabled={savingPlanFor === c.user_id || c.estado_suscripcion === 'sin_pago'}
                              onChange={(e) => handleSetPlan(c, e.target.value as PlanId)}
                              className="bg-slate-50/50 border border-slate-200 p-1.5 rounded text-slate-900 text-[10px]"
                            >
                              <option value="projects">Proyectos</option>
                              <option value="finance">Finanzas</option>
                              <option value="planner">Planner</option>
                              <option value="crm">Ventas / CRM</option>
                              <option value="completo">Completo</option>
                              <option value="custom">Personalizado</option>
                            </select>
                          </td>
                          <td className="py-2 pr-3">
                            {c.onboarding_completado
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              : <span className="text-[#8a8377] text-[10px]">Pendiente</span>}
                          </td>
                          <td className="py-2 pr-3 text-[#8a8377] font-mono text-[10px]">
                            {new Date(c.created_at).toLocaleDateString('es-CO')}
                          </td>
                          {teamRole === 'owner' && (
                            <td className="py-2 pr-3">
                              {c.estado_suscripcion !== 'sin_pago' && (
                                <button
                                  onClick={() => handleRevokeAccess(c)}
                                  disabled={savingPlanFor === c.user_id}
                                  className="text-red-600 hover:text-[#e08970] font-mono text-[10px] px-2 py-1 rounded border border-[#c97a61]/30 hover:bg-[#c97a61]/10 disabled:opacity-50"
                                >
                                  Revocar acceso
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {teamRole === 'owner' && (
              <form onSubmit={handleGrantCourtesy} className="bg-amber-50 border border-amber-100 rounded-lg p-5 space-y-3 text-xs">
                <h3 className="text-amber-700 font-mono uppercase text-[10px] tracking-wider font-bold">Dar acceso de cortesía</h3>
                <p className="text-slate-600 leading-relaxed">
                  Le da acceso sin pago a un email (aunque todavía no se haya registrado). Solo visible para el owner del equipo.
                </p>
                <div className="grid sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-1">
                    <label htmlFor="courtesy-email" className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Email</label>
                    <input
                      id="courtesy-email"
                      type="email"
                      value={courtesyEmail}
                      onChange={(e) => setCourtesyEmail(e.target.value)}
                      required
                      placeholder="cliente@empresa.com"
                      className="w-full bg-white border border-amber-200 p-2 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="courtesy-plan" className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Plan</label>
                    <select
                      id="courtesy-plan"
                      value={courtesyPlan}
                      onChange={(e) => setCourtesyPlan(e.target.value as PlanId)}
                      className="w-full bg-white border border-amber-200 p-2 rounded text-slate-900"
                    >
                      <option value="projects">Proyectos</option>
                      <option value="finance">Finanzas</option>
                      <option value="planner">Planner</option>
                      <option value="crm">Ventas / CRM</option>
                      <option value="completo">Completo</option>
                      <option value="custom">Personalizado</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="courtesy-notas" className="block text-[10px] font-mono uppercase text-slate-500 mb-1">Nota (opcional)</label>
                    <input
                      id="courtesy-notas"
                      value={courtesyNotas}
                      onChange={(e) => setCourtesyNotas(e.target.value)}
                      placeholder="Ej. Cliente de prueba, referido..."
                      className="w-full bg-white border border-amber-200 p-2 rounded text-slate-900"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={grantingCourtesy}
                  className="rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-white font-semibold disabled:opacity-50"
                >
                  {grantingCourtesy ? 'Guardando...' : 'Dar acceso de cortesía'}
                </button>
              </form>
            )}

            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-blue-600 font-mono uppercase text-[10px] tracking-wider font-bold">
                  Feedback de clientes ({feedbackList.filter((f) => feedbackFilter === 'todos' || f.estado === feedbackFilter).length})
                </h3>
                <select
                  value={feedbackFilter}
                  onChange={(e) => setFeedbackFilter(e.target.value as any)}
                  className="bg-slate-50/50 border border-slate-200 p-1.5 rounded text-slate-900 text-[10px]"
                >
                  <option value="todos">Todos</option>
                  <option value="nuevo">Nuevo</option>
                  <option value="revisado">Revisado</option>
                  <option value="resuelto">Resuelto</option>
                </select>
              </div>
              {!loadingCustomers && feedbackList.length === 0 && (
                <p className="text-xs text-[#8a8377]">Todavía no hay feedback de clientes.</p>
              )}
              <div className="space-y-2">
                {feedbackList
                  .filter((f) => feedbackFilter === 'todos' || f.estado === feedbackFilter)
                  .map((f) => (
                    <div key={f.id} className="border border-slate-100 rounded-lg p-3 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase border ${
                          f.tipo === 'bug' ? 'bg-[#c97a61]/15 text-red-600 border-[#c97a61]/40' : 'bg-blue-50 text-blue-600 border-blue-200'
                        }`}>
                          {f.tipo}
                        </span>
                        <span className="text-[#8a8377] font-mono text-[10px]">{f.email || 'sin email'}</span>
                        <span className="text-[#8a8377] font-mono text-[10px] ml-auto">{new Date(f.created_at).toLocaleString('es-CO')}</span>
                      </div>
                      <p className="text-slate-900 leading-relaxed whitespace-pre-wrap">{f.mensaje}</p>
                      <div className="flex items-center gap-1.5 pt-1">
                        {(['nuevo', 'revisado', 'resuelto'] as const).map((estado) => (
                          <button
                            key={estado}
                            onClick={() => handleUpdateFeedbackStatus(f, estado)}
                            disabled={f.estado === estado}
                            className={`text-[9px] font-mono uppercase px-2 py-1 rounded border ${
                              f.estado === estado ? 'bg-slate-100 text-slate-400 border-slate-200' : 'text-blue-600 border-blue-200 hover:bg-blue-50'
                            }`}
                          >
                            {estado}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'feedback' && <AdminFeedbackPanel />}
        {tab === 'analitica' && <AdminDeepAnalytics />}
      </main>
    </div>
  );
}

function RedditCommentability({ post }: { post: RedditPost }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-mono">
      <span className={post.can_comment ? 'text-emerald-700' : post.locked || post.archived ? 'text-red-600' : 'text-amber-700'}>
        {post.comment_status || 'Estado de comentarios no verificado'}
      </span>
      <a
        href={post.url}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 inline-flex items-center gap-1 text-blue-600 hover:underline"
      >
        <ExternalLink className="h-2.5 w-2.5" />
        {post.can_comment ? 'Abrir para comentar' : 'Verificar en Reddit'}
      </a>
    </div>
  );
}

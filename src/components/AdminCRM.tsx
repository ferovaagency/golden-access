import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Loader2, LogOut, Ban, Plus, ExternalLink, Trash2, Send, Bot, Calendar as CalendarIcon, X } from 'lucide-react';
import { logout, getAccessToken, googleSignIn, linkGoogleIdentity } from '../lib/supabase';
import { createDiagnosticEvent, deleteDiagnosticEvent } from '../lib/calendarService';
import {
  isTeamMember,
  listOportunidades,
  upsertOportunidad,
  deleteOportunidad,
  listCitas,
  upsertCita,
  listContenidoPotencial,
  upsertContenidoPotencial,
  analyzeContent,
  getBotConfig,
  saveBotConfig,
  listKnowledge,
  addKnowledge,
  deleteKnowledge,
  sendWhatsapp,
  listServiciosCatalogo,
  upsertServicioCatalogo,
  deleteServicioCatalogo,
  Oportunidad,
  CitaDiagnostico,
  ContenidoPotencial,
  EstadoOportunidad,
  BotConfig,
  KnowledgeItem,
  ServicioCatalogo,
} from '../lib/crmService';

const ESTADOS: EstadoOportunidad[] = ['nuevo', 'contactado', 'calificando', 'propuesta_enviada', 'negociacion', 'ganado', 'perdido'];

interface Props {
  user: User;
}

export default function AdminCRM({ user }: Props) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'pipeline' | 'citas' | 'contenido' | 'bot' | 'servicios'>('pipeline');
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [citas, setCitas] = useState<CitaDiagnostico[]>([]);
  const [contenido, setContenido] = useState<ContenidoPotencial[]>([]);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [serviciosCatalogo, setServiciosCatalogo] = useState<ServicioCatalogo[]>([]);
  const [loading, setLoading] = useState(false);

  const [nombreContacto, setNombreContacto] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [canalOrigen, setCanalOrigen] = useState('linkedin');
  const [fuenteUrl, setFuenteUrl] = useState('');
  const [telefono, setTelefono] = useState('');
  const [servicioCatalogoId, setServicioCatalogoId] = useState('');

  const [promptDraft, setPromptDraft] = useState('');
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [newKnowledge, setNewKnowledge] = useState('');
  const [newKnowledgeSource, setNewKnowledgeSource] = useState('');
  const [savingKnowledge, setSavingKnowledge] = useState(false);

  const [whatsappDrafts, setWhatsappDrafts] = useState<Record<string, string>>({});
  const [sendingWhatsapp, setSendingWhatsapp] = useState<string | null>(null);

  const [citaNombre, setCitaNombre] = useState('');
  const [citaEmail, setCitaEmail] = useState('');
  const [citaTelefono, setCitaTelefono] = useState('');
  const [citaFecha, setCitaFecha] = useState('');
  const [citaHora, setCitaHora] = useState('10:00');
  const [citaDuracion, setCitaDuracion] = useState(30);
  const [citaEsPagada, setCitaEsPagada] = useState(true);
  const [citaMonto, setCitaMonto] = useState<number | ''>('');
  const [citaOportunidadId, setCitaOportunidadId] = useState('');
  const [creatingCita, setCreatingCita] = useState(false);
  const [cancelingCitaId, setCancelingCitaId] = useState<string | null>(null);

  const [analyzePlataforma, setAnalyzePlataforma] = useState<'linkedin' | 'reddit'>('linkedin');
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [analyzeAutor, setAnalyzeAutor] = useState('');
  const [analyzeTexto, setAnalyzeTexto] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const [servicioNombre, setServicioNombre] = useState('');
  const [servicioCosto, setServicioCosto] = useState<number | ''>('');
  const [servicioPrecio, setServicioPrecio] = useState<number | ''>('');
  const [savingServicio, setSavingServicio] = useState(false);

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
      const [o, c, k, bc, kn, sc] = await Promise.all([
        listOportunidades(),
        listCitas(),
        listContenidoPotencial(),
        getBotConfig(),
        listKnowledge(),
        listServiciosCatalogo(),
      ]);
      setOportunidades(o);
      setCitas(c);
      setContenido(k);
      setBotConfig(bc);
      setPromptDraft(bc.custom_prompt || '');
      setKnowledge(kn);
      setServiciosCatalogo(sc);
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

  const ensureGoogleToken = async (): Promise<string | null> => {
    const existing = getAccessToken();
    if (existing) return existing;
    try {
      if (user.identities?.some((i) => i.provider === 'google')) {
        await googleSignIn();
      } else {
        await linkGoogleIdentity();
      }
    } catch (err: any) {
      alert(`No se pudo conectar Google Calendar: ${err.message || err}`);
    }
    // El flujo de OAuth redirige la página; tras volver, el usuario debe reintentar.
    return null;
  };

  const handleCreateCita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citaNombre.trim() || !citaFecha || !citaHora) return;

    const token = await ensureGoogleToken();
    if (!token) {
      alert('Conecta tu Google Calendar y vuelve a intentar agendar la cita.');
      return;
    }

    setCreatingCita(true);
    try {
      const start = new Date(`${citaFecha}T${citaHora}:00`);
      const end = new Date(start.getTime() + citaDuracion * 60000);

      const { eventId, meetLink } = await createDiagnosticEvent(token, {
        summary: `Diagnóstico Ferova Agency · ${citaNombre.trim()}`,
        description: citaTelefono ? `Teléfono: ${citaTelefono}` : 'Cita de diagnóstico agendada desde el CRM interno.',
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        attendeeEmail: citaEmail.trim() || undefined,
      });

      const created = await upsertCita({
        oportunidad_id: citaOportunidadId || null,
        nombre_prospecto: citaNombre.trim(),
        email_prospecto: citaEmail.trim() || null,
        telefono_prospecto: citaTelefono.trim() || null,
        fecha_hora: start.toISOString(),
        duracion_min: citaDuracion,
        estado: 'agendada',
        es_pagada: citaEsPagada,
        monto: citaMonto === '' ? null : Number(citaMonto),
        calendar_event_id: eventId,
        meet_link: meetLink,
      });

      setCitas([...citas, created].sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora)));
      setCitaNombre('');
      setCitaEmail('');
      setCitaTelefono('');
      setCitaFecha('');
      setCitaMonto('');
      setCitaOportunidadId('');
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        alert('Tu sesión de Google Calendar expiró. Vuelve a conectar Google e intenta de nuevo.');
      } else {
        alert(`Error agendando la cita: ${err.message || err}`);
      }
    } finally {
      setCreatingCita(false);
    }
  };

  const handleCancelCita = async (cita: CitaDiagnostico) => {
    if (!window.confirm(`¿Cancelar la cita con ${cita.nombre_prospecto}?`)) return;
    setCancelingCitaId(cita.id);
    try {
      const token = getAccessToken();
      if (token && cita.calendar_event_id) {
        try {
          await deleteDiagnosticEvent(token, cita.calendar_event_id);
        } catch (err: any) {
          console.warn('No se pudo cancelar el evento en Google Calendar:', err.message || err);
        }
      }
      const updated = await upsertCita({ id: cita.id, estado: 'cancelada' });
      setCitas(citas.map((c) => (c.id === cita.id ? updated : c)));
    } catch (err: any) {
      alert(`Error cancelando la cita: ${err.message || err}`);
    } finally {
      setCancelingCitaId(null);
    }
  };

  const handleCreateOportunidad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreContacto.trim()) return;
    try {
      const created = await upsertOportunidad({
        nombre_contacto: nombreContacto.trim(),
        empresa: empresa.trim() || null,
        canal_origen: canalOrigen as any,
        estado: 'nuevo',
        fuente_url: fuenteUrl.trim() || null,
        telefono: telefono.trim() || null,
        servicio_catalogo_id: servicioCatalogoId || null,
      });
      setOportunidades([created, ...oportunidades]);
      setNombreContacto('');
      setEmpresa('');
      setFuenteUrl('');
      setTelefono('');
      setServicioCatalogoId('');
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

  const handleAnalyzeContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analyzeUrl.trim() || !analyzeTexto.trim()) return;
    setAnalyzing(true);
    try {
      const created = await analyzeContent(analyzePlataforma, analyzeUrl.trim(), analyzeTexto.trim(), analyzeAutor.trim() || undefined);
      setContenido([created, ...contenido]);
      setAnalyzeUrl('');
      setAnalyzeAutor('');
      setAnalyzeTexto('');
    } catch (err: any) {
      alert(`Error analizando la publicación: ${err.message || err}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateServicio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!servicioNombre.trim()) return;
    setSavingServicio(true);
    try {
      const id = `svc_${Date.now().toString().slice(-8)}`;
      const created = await upsertServicioCatalogo({
        id,
        nombre: servicioNombre.trim(),
        costo_estimado: servicioCosto === '' ? 0 : Number(servicioCosto),
        precio_venta_estimado: servicioPrecio === '' ? 0 : Number(servicioPrecio),
        moneda: 'COP',
      });
      setServiciosCatalogo([...serviciosCatalogo, created].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setServicioNombre('');
      setServicioCosto('');
      setServicioPrecio('');
    } catch (err: any) {
      alert(`Error guardando el servicio: ${err.message || err}`);
    } finally {
      setSavingServicio(false);
    }
  };

  const handleDeleteServicio = async (id: string) => {
    if (!window.confirm('¿Eliminar este servicio del catálogo?')) return;
    try {
      await deleteServicioCatalogo(id);
      setServiciosCatalogo(serviciosCatalogo.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(`Error eliminando: ${err.message || err}`);
    }
  };

  const margenPct = (s: ServicioCatalogo) =>
    s.precio_venta_estimado > 0 ? Math.round(((s.precio_venta_estimado - s.costo_estimado) / s.precio_venta_estimado) * 100) : null;

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
        {(['pipeline', 'citas', 'contenido', 'bot', 'servicios'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded uppercase tracking-wider font-semibold ${
              tab === t ? 'bg-[#c9a961]/15 text-[#c9a961] border border-[#c9a961]/40' : 'text-[#a39d8e] hover:text-white'
            }`}
          >
            {t === 'pipeline' ? 'Pipeline' : t === 'citas' ? 'Citas de diagnóstico' : t === 'contenido' ? 'Contenido con potencial' : t === 'bot' ? 'Bot de WhatsApp' : 'Servicios'}
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
              {serviciosCatalogo.length > 0 && (
                <select
                  value={servicioCatalogoId}
                  onChange={(e) => setServicioCatalogoId(e.target.value)}
                  className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                >
                  <option value="">Servicio de interés (opcional)</option>
                  {serviciosCatalogo.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              )}
              <button type="submit" className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Crear
              </button>
            </form>

            <div className="lg:col-span-8 space-y-2">
              {oportunidades.length === 0 && !loading && (
                <p className="text-[#8a8377] text-xs font-mono text-center py-10">Sin oportunidades todavía.</p>
              )}
              {oportunidades.map((o) => {
                const servicioLigado = serviciosCatalogo.find((s) => s.id === o.servicio_catalogo_id);
                const margen = servicioLigado ? margenPct(servicioLigado) : null;
                return (
                <div key={o.id} className="bg-[#161412] border border-[#2a2620] rounded-lg p-4 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-semibold text-[#e8e3d8]">{o.nombre_contacto}</div>
                      <div className="text-[#8a8377] font-mono text-[10px]">
                        {o.empresa || 'Sin empresa'} · {o.canal_origen}{o.telefono ? ` · ${o.telefono}` : ''}
                      </div>
                    </div>
                    {servicioLigado && (
                      <span
                        className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                          margen !== null && margen >= 40
                            ? 'bg-[#a8c98a]/10 text-[#a8c98a] border-[#a8c98a]/30'
                            : 'bg-[#c97a61]/10 text-[#c97a61] border-[#c97a61]/30'
                        }`}
                        title={`${servicioLigado.nombre}: costo ${servicioLigado.costo_estimado} / precio ${servicioLigado.precio_venta_estimado}`}
                      >
                        {servicioLigado.nombre} · margen {margen ?? '-'}%
                      </span>
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
            <form onSubmit={handleCreateCita} className="lg:col-span-4 bg-[#161412] border border-[#2a2620] rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-[#c9a961] font-mono uppercase text-[10px] tracking-wider font-bold flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5" /> Agendar diagnóstico
              </h3>
              <input
                value={citaNombre}
                onChange={(e) => setCitaNombre(e.target.value)}
                placeholder="Nombre del prospecto"
                required
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <input
                type="email"
                value={citaEmail}
                onChange={(e) => setCitaEmail(e.target.value)}
                placeholder="Email (para invitarlo por Calendar)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <input
                value={citaTelefono}
                onChange={(e) => setCitaTelefono(e.target.value)}
                placeholder="WhatsApp (opcional)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              {oportunidades.length > 0 && (
                <select
                  value={citaOportunidadId}
                  onChange={(e) => setCitaOportunidadId(e.target.value)}
                  className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                >
                  <option value="">Sin ligar a oportunidad</option>
                  {oportunidades.map((o) => (
                    <option key={o.id} value={o.id}>{o.nombre_contacto}</option>
                  ))}
                </select>
              )}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={citaFecha}
                  onChange={(e) => setCitaFecha(e.target.value)}
                  required
                  className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                />
                <input
                  type="time"
                  value={citaHora}
                  onChange={(e) => setCitaHora(e.target.value)}
                  required
                  className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                />
              </div>
              <select
                value={citaDuracion}
                onChange={(e) => setCitaDuracion(Number(e.target.value))}
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              >
                <option value={30}>30 minutos</option>
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
              <div className="flex items-center justify-between bg-[#0f0e0c]/30 border border-[#2a2620] p-2.5 rounded">
                <span>Diagnóstico pagado</span>
                <input type="checkbox" checked={citaEsPagada} onChange={(e) => setCitaEsPagada(e.target.checked)} className="accent-[#c9a961]" />
              </div>
              {citaEsPagada && (
                <input
                  type="number"
                  min="0"
                  value={citaMonto}
                  onChange={(e) => setCitaMonto(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Monto cobrado (opcional)"
                  className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
                />
              )}
              <button
                type="submit"
                disabled={creatingCita}
                className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> {creatingCita ? 'Agendando...' : 'Agendar en Google Calendar'}
              </button>
              <p className="text-[#8a8377] text-[10px] leading-relaxed">
                Si no has conectado Google, se abrirá una ventana para autorizarlo — vuelve a pulsar "Agendar" después de conectar.
              </p>
            </form>

            <div className="lg:col-span-8 space-y-2">
              {citas.length === 0 && !loading && (
                <p className="text-[#8a8377] text-xs font-mono text-center py-10">Sin citas agendadas todavía.</p>
              )}
              {citas.map((c) => (
                <div key={c.id} className="bg-[#161412] border border-[#2a2620] rounded-lg p-4 flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-semibold text-[#e8e3d8]">{c.nombre_prospecto}</div>
                    <div className="text-[#8a8377] font-mono text-[10px]">
                      {new Date(c.fecha_hora).toLocaleString('es-CO')} · {c.duracion_min} min
                    </div>
                  </div>
                  <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-[#c9a961]/10 text-[#c9a961] border border-[#c9a961]/30">
                    {c.estado}
                  </span>
                  {c.es_pagada && <span className="text-[10px] font-mono text-[#a8c98a]">Pagada</span>}
                  {c.meet_link && (
                    <a href={c.meet_link} target="_blank" rel="noreferrer" className="text-[#c9a961] flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> unirse
                    </a>
                  )}
                  {c.estado !== 'cancelada' && (
                    <button
                      onClick={() => handleCancelCita(c)}
                      disabled={cancelingCitaId === c.id}
                      className="text-[#c97a61] hover:text-[#e08970] p-1 disabled:opacity-40"
                      title="Cancelar cita"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'contenido' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleAnalyzeContent} className="lg:col-span-4 bg-[#161412] border border-[#2a2620] rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-[#c9a961] font-mono uppercase text-[10px] tracking-wider font-bold">Analizar publicación</h3>
              <p className="text-[#8a8377] text-[10px] leading-relaxed">
                Pega el link y el texto de una publicación de LinkedIn o Reddit (no la buscamos automáticamente — LinkedIn no lo permite sin arriesgar la cuenta). La IA la puntúa y redacta un comentario sugerido.
              </p>
              <select
                value={analyzePlataforma}
                onChange={(e) => setAnalyzePlataforma(e.target.value as 'linkedin' | 'reddit')}
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              >
                <option value="linkedin">LinkedIn</option>
                <option value="reddit">Reddit</option>
              </select>
              <input
                value={analyzeUrl}
                onChange={(e) => setAnalyzeUrl(e.target.value)}
                placeholder="Link de la publicación"
                required
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <input
                value={analyzeAutor}
                onChange={(e) => setAnalyzeAutor(e.target.value)}
                placeholder="Autor (opcional)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <textarea
                value={analyzeTexto}
                onChange={(e) => setAnalyzeTexto(e.target.value)}
                rows={5}
                placeholder="Pega aquí el texto completo de la publicación..."
                required
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2.5 rounded text-white"
              />
              <button
                type="submit"
                disabled={analyzing}
                className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded disabled:opacity-50"
              >
                {analyzing ? 'Analizando...' : 'Analizar y sugerir comentario'}
              </button>
            </form>

            <div className="lg:col-span-8 space-y-2">
            {contenido.length === 0 && !loading && (
              <p className="text-[#8a8377] text-xs font-mono text-center py-10">
                Sin contenido detectado todavía. Aquí aparecerán publicaciones de LinkedIn/Reddit con potencial, junto a un comentario sugerido para que publiques manualmente.
              </p>
            )}
            {contenido.map((c) => (
              <div key={c.id} className="bg-[#161412] border border-[#2a2620] rounded-lg p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <a href={c.url_publicacion} target="_blank" rel="noreferrer" className="text-[#c9a961] flex items-center gap-1 font-semibold">
                    <ExternalLink className="w-3 h-3" /> {c.plataforma} · {c.autor || 'autor desconocido'}
                  </a>
                  <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-[#c9a961]/10 text-[#c9a961] border border-[#c9a961]/30">
                    score {c.score_potencial ?? '-'}
                  </span>
                </div>
                {c.resumen && <p className="text-[#a39d8e]">{c.resumen}</p>}
                {c.comentario_sugerido && (
                  <div className="bg-[#0f0e0c]/50 border border-[#2a2620] rounded p-3">
                    <span className="text-[9px] font-mono uppercase text-[#8a8377] block mb-1">Comentario sugerido:</span>
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

        {tab === 'servicios' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form onSubmit={handleCreateServicio} className="lg:col-span-4 bg-[#161412] border border-[#2a2620] rounded-lg p-5 space-y-3 text-xs h-fit">
              <h3 className="text-[#c9a961] font-mono uppercase text-[10px] tracking-wider font-bold">Nuevo servicio (catálogo propio)</h3>
              <p className="text-[#8a8377] text-[10px] leading-relaxed">
                Costo y precio de referencia de tus servicios, para que el pipeline priorice por rentabilidad real (independiente de las cuentas de tus clientes en Ferova OS Financiero).
              </p>
              <input
                value={servicioNombre}
                onChange={(e) => setServicioNombre(e.target.value)}
                placeholder="Nombre del servicio"
                required
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <input
                type="number"
                min="0"
                value={servicioCosto}
                onChange={(e) => setServicioCosto(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Costo estimado (COP)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <input
                type="number"
                min="0"
                value={servicioPrecio}
                onChange={(e) => setServicioPrecio(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Precio de venta estimado (COP)"
                className="w-full bg-[#0f0e0c]/50 border border-[#2a2620] p-2 rounded text-white"
              />
              <button
                type="submit"
                disabled={savingServicio}
                className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> {savingServicio ? 'Guardando...' : 'Agregar servicio'}
              </button>
            </form>

            <div className="lg:col-span-8 space-y-2">
              {serviciosCatalogo.length === 0 && (
                <p className="text-[#8a8377] text-xs font-mono text-center py-10">Sin servicios en el catálogo todavía.</p>
              )}
              {serviciosCatalogo.map((s) => {
                const margen = margenPct(s);
                return (
                  <div key={s.id} className="bg-[#161412] border border-[#2a2620] rounded-lg p-4 flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-semibold text-[#e8e3d8]">{s.nombre}</div>
                      <div className="text-[#8a8377] font-mono text-[10px]">
                        Costo ${s.costo_estimado.toLocaleString('es-CO')} · Precio ${s.precio_venta_estimado.toLocaleString('es-CO')}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                        margen !== null && margen >= 40
                          ? 'bg-[#a8c98a]/10 text-[#a8c98a] border-[#a8c98a]/30'
                          : 'bg-[#c97a61]/10 text-[#c97a61] border-[#c97a61]/30'
                      }`}
                    >
                      margen {margen ?? '-'}%
                    </span>
                    <button onClick={() => handleDeleteServicio(s.id)} className="text-[#c97a61] hover:text-[#e08970]">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

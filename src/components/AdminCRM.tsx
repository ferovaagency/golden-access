import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Loader2, LogOut, Ban, Plus, ExternalLink, Trash2 } from 'lucide-react';
import { logout } from '../lib/supabase';
import {
  isTeamMember,
  listOportunidades,
  upsertOportunidad,
  deleteOportunidad,
  listCitas,
  listContenidoPotencial,
  upsertContenidoPotencial,
  Oportunidad,
  CitaDiagnostico,
  ContenidoPotencial,
  EstadoOportunidad,
} from '../lib/crmService';

const ESTADOS: EstadoOportunidad[] = ['nuevo', 'contactado', 'calificando', 'propuesta_enviada', 'negociacion', 'ganado', 'perdido'];

interface Props {
  user: User;
}

export default function AdminCRM({ user }: Props) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'pipeline' | 'citas' | 'contenido'>('pipeline');
  const [oportunidades, setOportunidades] = useState<Oportunidad[]>([]);
  const [citas, setCitas] = useState<CitaDiagnostico[]>([]);
  const [contenido, setContenido] = useState<ContenidoPotencial[]>([]);
  const [loading, setLoading] = useState(false);

  const [nombreContacto, setNombreContacto] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [canalOrigen, setCanalOrigen] = useState('linkedin');
  const [fuenteUrl, setFuenteUrl] = useState('');

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
      const [o, c, k] = await Promise.all([listOportunidades(), listCitas(), listContenidoPotencial()]);
      setOportunidades(o);
      setCitas(c);
      setContenido(k);
    } catch (err: any) {
      alert(`Error cargando el CRM: ${err.message || err}`);
    } finally {
      setLoading(false);
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
      });
      setOportunidades([created, ...oportunidades]);
      setNombreContacto('');
      setEmpresa('');
      setFuenteUrl('');
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
        {(['pipeline', 'citas', 'contenido'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded uppercase tracking-wider font-semibold ${
              tab === t ? 'bg-[#c9a961]/15 text-[#c9a961] border border-[#c9a961]/40' : 'text-[#a39d8e] hover:text-white'
            }`}
          >
            {t === 'pipeline' ? 'Pipeline' : t === 'citas' ? 'Citas de diagnóstico' : 'Contenido con potencial'}
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
              <button type="submit" className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-bold py-2 rounded flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Crear
              </button>
            </form>

            <div className="lg:col-span-8 space-y-2">
              {oportunidades.length === 0 && !loading && (
                <p className="text-[#8a8377] text-xs font-mono text-center py-10">Sin oportunidades todavía.</p>
              )}
              {oportunidades.map((o) => (
                <div key={o.id} className="bg-[#161412] border border-[#2a2620] rounded-lg p-4 flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-semibold text-[#e8e3d8]">{o.nombre_contacto}</div>
                    <div className="text-[#8a8377] font-mono text-[10px]">{o.empresa || 'Sin empresa'} · {o.canal_origen}</div>
                  </div>
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
              ))}
            </div>
          </div>
        )}

        {tab === 'citas' && (
          <div className="space-y-2">
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
              </div>
            ))}
          </div>
        )}

        {tab === 'contenido' && (
          <div className="space-y-2">
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
        )}
      </main>
    </div>
  );
}

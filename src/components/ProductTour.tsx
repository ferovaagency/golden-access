import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import type { ModuleFlags } from '../lib/planService';

// Recorrido guiado estilo videojuego: el "Copiloto Ferova" (avatar geométrico
// en SVG, flotando abajo a la derecha) habla en un globo de diálogo con barra
// de misiones, y un halo resalta el ítem del menú de cada estación. Cambia de
// pestaña solo (onNavigate) y se puede repetir con el evento
// `ferova:start-tour` (Ajustes y barra superior).
//
// El halo busca `[data-tour="<id>"]` en el DOM: las navegaciones (sección e
// ítems) y el botón del asistente llevan ese atributo.

interface Props { userId: string; modules: ModuleFlags; onNavigate: (tab: string) => void; }

interface Station { tab: string; target: string; titulo: string; texto: string }

function CopilotAvatar() {
  return (
    <div className="relative h-24 w-24 animate-[fv-float_3.2s_ease-in-out_infinite]" aria-hidden>
      <svg viewBox="0 0 96 96" className="h-full w-full drop-shadow-[0_12px_24px_rgba(15,23,42,.35)]">
        <defs>
          <linearGradient id="fvBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1e3a8a" /><stop offset="1" stopColor="#2563eb" /></linearGradient>
          <linearGradient id="fvGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
        </defs>
        {/* antena */}
        <line x1="48" y1="14" x2="48" y2="24" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        <circle cx="48" cy="11" r="4" fill="url(#fvGold)" />
        {/* cabeza */}
        <rect x="20" y="24" width="56" height="44" rx="16" fill="url(#fvBody)" />
        <rect x="26" y="30" width="44" height="30" rx="12" fill="#0b1220" opacity=".9" />
        {/* ojos */}
        <g className="fv-blink">
          <rect x="34" y="40" width="9" height="10" rx="3" fill="#7dd3fc" />
          <rect x="53" y="40" width="9" height="10" rx="3" fill="#7dd3fc" />
        </g>
        {/* boca */}
        <path d="M40 54 q8 5 16 0" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* cuerpo */}
        <rect x="30" y="70" width="36" height="16" rx="8" fill="url(#fvBody)" />
        <rect x="42" y="74" width="12" height="4" rx="2" fill="url(#fvGold)" />
      </svg>
      <style>{`
        @keyframes fv-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
        @keyframes fv-blink { 0%,92%,100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
        .fv-blink { transform-origin: 48px 45px; animation: fv-blink 4.5s ease-in-out infinite; }
        @keyframes fv-halo { 0%,100% { box-shadow: 0 0 0 4px rgba(245,158,11,.55), 0 0 24px 6px rgba(245,158,11,.35) } 50% { box-shadow: 0 0 0 7px rgba(245,158,11,.35), 0 0 34px 10px rgba(245,158,11,.25) } }
      `}</style>
    </div>
  );
}

/** Halo luminoso sobre el elemento `[data-tour=target]`, si está en pantalla. */
function Spotlight({ target }: { target: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      const r = el?.getBoundingClientRect() ?? null;
      setRect(r && r.width > 0 ? r : null);
    };
    // El cambio de pestaña re-renderiza el menú: medir después de pintar, y
    // seguir el scroll/resize mientras la estación esté activa.
    const tick = () => { measure(); frame = window.requestAnimationFrame(tick); };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);
  if (!rect) return null;
  return <div aria-hidden className="pointer-events-none fixed z-[79] rounded-xl animate-[fv-halo_1.6s_ease-in-out_infinite]" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />;
}

export default function ProductTour({ userId, modules, onNavigate }: Props) {
  const storageKey = `ferova.product-tour.${userId}`;
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) !== 'done');
  const [index, setIndex] = useState(0);

  const stations = useMemo<Station[]>(() => [
    { tab: 'dashboard', target: 'tab-dashboard', titulo: 'Conoce tu centro de mando', texto: '¡Listo! Ya tienes tus servicios y costos cargados. Aquí en Inicio ves tu pulso diario: balance de caja, tareas prioritarias y alertas críticas antes de empezar a trabajar.' },
    ...(modules.planner ? [{ tab: 'planner', target: 'tab-planner', titulo: 'Tu agenda inteligente', texto: 'Escribe lo que tienes que hacer en lenguaje natural y el Planner lo convierte en tareas con cliente y fecha. Organiza bloques de trabajo profundo, llamadas y reuniones sin sobrecargar tu energía.' }] : []),
    { tab: 'proyectos', target: 'tab-proyectos', titulo: 'Donde tus clientes cobran vida', texto: 'Aquí ves el avance, las horas dedicadas y la rentabilidad de cada entrega. Cada hora que registras se convierte en un número de verdad.' },
    ...(modules.finance ? [{ tab: 'finops', target: 'tab-finops', titulo: 'Tus números, vivos', texto: '¡Tu presupuesto y tus costos ya están aquí! Revisa márgenes, punto de equilibrio y cuentas por cobrar. Nada de recalcular hojas de Excel.' }] : []),
    { tab: '__ai', target: 'ai-toggle', titulo: 'Tu copiloto, siempre al lado', texto: 'Y siempre que tengas una duda o quieras delegar algo, háblame en el panel derecho. Veo tus datos y te digo la siguiente jugada.' },
  ], [modules]);

  useEffect(() => {
    const restart = () => { setIndex(0); setOpen(true); onNavigate(stations[0].tab); };
    window.addEventListener('ferova:start-tour', restart);
    return () => window.removeEventListener('ferova:start-tour', restart);
  }, [onNavigate, stations]);

  useEffect(() => { if (open && stations[index]) onNavigate(stations[index].tab); }, [index, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { localStorage.setItem(storageKey, 'done'); setOpen(false); };
  if (!open || !stations[index]) return null;
  const station = stations[index];
  const last = index === stations.length - 1;
  const progreso = ((index + 1) / stations.length) * 100;

  return (
    <>
      <Spotlight target={station.target} />
      <aside className="fixed bottom-4 right-4 z-[80] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 sm:bottom-6 sm:right-6" aria-live="polite">
        {/* Globo de diálogo */}
        <div className="relative w-[min(92vw,400px)] rounded-2xl border border-amber-200 bg-white p-4 shadow-[0_22px_55px_rgba(15,23,42,.28)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">Misión {index + 1}/{stations.length} · {station.titulo}</p>
            <button type="button" onClick={close} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Cerrar recorrido"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500" style={{ width: `${progreso}%` }} /></div>
          <p className="mt-3 text-sm leading-6 text-slate-800">“{station.texto}”</p>
          <div className="mt-4 flex items-center justify-between">
            <button type="button" onClick={close} className="text-xs font-semibold text-slate-400 hover:text-slate-700">Omitir tutorial</button>
            <button type="button" onClick={() => (last ? close() : setIndex((v) => v + 1))} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800">
              {last ? <><Check className="h-4 w-4" /> Misión cumplida</> : <>Siguiente nivel <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
          {/* cola del globo hacia el avatar */}
          <span aria-hidden className="absolute -bottom-2 right-10 h-4 w-4 rotate-45 border-b border-r border-amber-200 bg-white" />
        </div>
        {/* Avatar + rango */}
        <div className="flex items-end gap-2 pr-1">
          <span className="mb-3 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 shadow-sm">Copiloto Ferova</span>
          <CopilotAvatar />
        </div>
      </aside>
    </>
  );
}

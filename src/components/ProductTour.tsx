import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, GripHorizontal, X } from 'lucide-react';
import type { ModuleFlags } from '../lib/planService';

// Recorrido guiado estilo videojuego: el "Copiloto Ferova" (avatar geométrico
// en SVG, flotando abajo a la derecha) habla en un globo de diálogo con barra
// de misiones, y un halo resalta el ítem del menú de cada estación. Cambia de
// pestaña solo (onNavigate) y se puede repetir con el evento
// `ferova:start-tour` (Ajustes y barra superior).
//
// El halo busca `[data-tour="<id>"]` en el DOM: las navegaciones (sección e
// ítems) y el botón del asistente llevan ese atributo.
//
// El globo es compacto y se arrastra desde su cabecera (la posición se
// recuerda en localStorage) para que no tape lo que está explicando.

interface Props { userId: string; modules: ModuleFlags; onNavigate: (tab: string) => void; }

interface Station { tab: string; target: string; titulo: string; texto: string }

function CopilotAvatar() {
  return (
    <div className="relative h-16 w-16 animate-[fv-float_3.2s_ease-in-out_infinite]" aria-hidden>
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

const POS_KEY = 'ferova.product-tour.pos';

export default function ProductTour({ userId, modules, onNavigate }: Props) {
  const storageKey = `ferova.product-tour.${userId}`;
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) !== 'done');
  const [index, setIndex] = useState(0);
  // Posición del globo (esquina superior izquierda). null = abajo a la derecha.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try { const raw = localStorage.getItem(POS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const stations = useMemo<Station[]>(() => [
    { tab: 'dashboard', target: 'tab-dashboard', titulo: 'Tu centro de mando', texto: '¡Listo! Ya tienes tus servicios y costos cargados. Aquí en Inicio ves tu pulso diario: balance de caja, tareas prioritarias y alertas antes de empezar a trabajar.' },
    { tab: 'clientes', target: 'tab-clientes', titulo: 'Tus clientes', texto: 'Cada cliente tiene su ficha: qué le vendes, cuánto te deja y las horas que te consume. Los que cargaste en el onboarding ya están aquí.' },
    { tab: 'servicios', target: 'tab-servicios', titulo: 'Tu catálogo', texto: 'Precio y costo de cada servicio. De aquí sale el margen real por unidad y la base para cotizar sin adivinar.' },
    ...(modules.planner ? [{ tab: 'planner', target: 'tab-planner', titulo: 'Tu agenda inteligente', texto: 'Escribe lo que tienes que hacer en lenguaje natural y el Planner lo convierte en tareas con cliente y fecha. Prioriza por dinero y entrega, y protege tus bloques de trabajo profundo.' }] : []),
    { tab: 'proyectos', target: 'tab-proyectos', titulo: 'Donde tus clientes cobran vida', texto: 'Avance, horas dedicadas y rentabilidad de cada entrega. Cada hora que registras se convierte en un número de verdad.' },
    { tab: 'gastos', target: 'tab-gastos', titulo: 'Tus costos', texto: 'Los costos fijos del onboarding viven aquí. Puedes marcar cuáles son por cliente y a qué servicios pertenecen: así el margen de cada servicio es real.' },
    ...(modules.finance ? [
      { tab: 'finops', target: 'tab-finops', titulo: 'Tus números, vivos', texto: '¡Tu presupuesto ya está aquí! Cuentas por cobrar, deudas y flujo de caja del mes. Nada de recalcular hojas de Excel.' },
      { tab: 'equilibrioGlobal', target: 'tab-equilibrioGlobal', titulo: 'Tu punto de equilibrio', texto: 'Cuánto necesitas facturar al mes para cubrir costos y tu sueldo. Con lo que cargaste ya tienes el número; cámbialo cuando cambien tus costos.' },
    ] : []),
    ...(modules.crm_ventas ? [{ tab: 'ventas-crm', target: 'tab-ventas-crm', titulo: 'Tu pipeline', texto: 'Oportunidades, cotizaciones y valor ganado. Lo que entra aquí termina como cliente en Proyectos.' }] : []),
    { tab: 'memoria', target: 'tab-memoria', titulo: 'Lo que sé de ti', texto: 'La Memoria guarda cómo trabajas, tus procesos y tus decisiones. Cuanto más le cuentes, mejores respuestas te doy.' },
    { tab: '__ai', target: 'ai-toggle', titulo: 'Tu copiloto, siempre al lado', texto: 'Y cuando tengas una duda o quieras delegar algo, háblame en el panel derecho. Veo tus datos y te digo la siguiente jugada. Puedes repetir este recorrido desde la brújula de arriba.' },
  ], [modules]);

  useEffect(() => {
    const restart = () => { setIndex(0); setOpen(true); onNavigate(stations[0].tab); };
    window.addEventListener('ferova:start-tour', restart);
    return () => window.removeEventListener('ferova:start-tour', restart);
  }, [onNavigate, stations]);

  useEffect(() => { if (open && stations[index] && stations[index].tab !== '__ai') onNavigate(stations[index].tab); }, [index, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arrastre desde la cabecera del globo.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const w = boxRef.current?.offsetWidth ?? 320;
      const h = boxRef.current?.offsetHeight ?? 200;
      const x = Math.min(Math.max(8, e.clientX - drag.current.dx), window.innerWidth - w - 8);
      const y = Math.min(Math.max(8, e.clientY - drag.current.dy), window.innerHeight - h - 8);
      setPos({ x, y });
    };
    const up = () => {
      if (!drag.current) return;
      drag.current = null;
      setPos((p) => { try { if (p) localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* noop */ } return p; });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  const startDrag = (e: React.PointerEvent) => {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.preventDefault();
  };

  const close = () => { localStorage.setItem(storageKey, 'done'); setOpen(false); };
  if (!open || !stations[index]) return null;
  const station = stations[index];
  const last = index === stations.length - 1;
  const progreso = ((index + 1) / stations.length) * 100;
  const style = pos ? { left: pos.x, top: pos.y } : undefined;

  return (
    <>
      <Spotlight target={station.target} />
      <aside
        ref={boxRef}
        style={style}
        className={`fixed z-[80] flex w-[min(92vw,340px)] flex-col items-end gap-1.5 ${pos ? '' : 'bottom-4 right-4 sm:bottom-6 sm:right-6'}`}
        aria-live="polite"
      >
        {/* Globo de diálogo */}
        <div className="relative w-full rounded-2xl border border-amber-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,.22)]">
          <div onPointerDown={startDrag} className="flex cursor-grab touch-none select-none items-center justify-between gap-2 rounded-t-2xl border-b border-amber-100 bg-amber-50/70 px-3 py-1.5 active:cursor-grabbing" title="Arrastra para mover">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700"><GripHorizontal className="mr-1 inline h-3 w-3 text-amber-400" />Misión {index + 1}/{stations.length} · {station.titulo}</p>
            <button type="button" onClick={close} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100" aria-label="Cerrar recorrido"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="px-3 pb-3 pt-2">
            <div className="h-1 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500" style={{ width: `${progreso}%` }} /></div>
            <p className="mt-2 text-[13px] leading-5 text-slate-800">“{station.texto}”</p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button type="button" onClick={close} className="text-[11px] font-semibold text-slate-400 hover:text-slate-700">Omitir</button>
              <div className="flex items-center gap-1.5">
                {index > 0 && <button type="button" onClick={() => setIndex((v) => v - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" aria-label="Anterior"><ArrowLeft className="h-3.5 w-3.5" /></button>}
                <button type="button" onClick={() => (last ? close() : setIndex((v) => v + 1))} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800">
                  {last ? <><Check className="h-3.5 w-3.5" /> Misión cumplida</> : <>Siguiente <ArrowRight className="h-3.5 w-3.5" /></>}
                </button>
              </div>
            </div>
          </div>
          {/* cola del globo hacia el avatar */}
          <span aria-hidden className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 border-b border-r border-amber-200 bg-white" />
        </div>
        {/* Avatar + rango */}
        <div className="flex items-end gap-1.5 pr-1">
          <span className="mb-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800 shadow-sm">Copiloto Ferova</span>
          <CopilotAvatar />
        </div>
      </aside>
    </>
  );
}

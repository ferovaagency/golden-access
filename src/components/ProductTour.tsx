import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import type { ModuleFlags } from '../lib/planService';

interface Props { userId: string; modules: ModuleFlags; onNavigate: (tab: string) => void; }

export default function ProductTour({ userId, modules, onNavigate }: Props) {
  const storageKey = `ferova.product-tour.${userId}`;
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) !== 'done');
  const [index, setIndex] = useState(0);
  const steps = useMemo(() => [
    { tab: 'dashboard', title: 'Tu centro de control', text: 'Empieza por las acciones rápidas y las prioridades de hoy. Puedes reordenar sus bloques.' },
    { tab: 'proyectos', title: 'Proyectos conectan el negocio', text: 'Objetivos, KPIs, tareas, clientes, horas y resultados nacen o se relacionan aquí.' },
    ...(modules.finance ? [{ tab: 'finops', title: 'Finanzas operativas', text: 'Controla caja, deudas, facturas, presupuesto, comprobantes y el estado financiero.' }] : []),
    ...(modules.planner ? [{ tab: 'planner', title: 'Planner', text: 'Organiza tareas por día, semana o calendario y protege los bloques que no deben moverse.' }] : []),
    ...(modules.crm ? [{ tab: 'ventas-crm', title: 'Ventas', text: 'Gestiona oportunidades, origen, seguimiento y próximas acciones desde el pipeline.' }] : []),
    { tab: 'ajustes', title: 'Personalización y Google', text: 'Completa tu perfil fiscal, identidad comercial y conexiones desde Ajustes.' },
  ], [modules]);

  useEffect(() => {
    const restart = () => { setIndex(0); setOpen(true); onNavigate(steps[0].tab); };
    window.addEventListener('ferova:start-tour', restart);
    return () => window.removeEventListener('ferova:start-tour', restart);
  }, [onNavigate, steps]);

  useEffect(() => { if (open && steps[index]) onNavigate(steps[index].tab); }, [index, open]);

  const close = () => { localStorage.setItem(storageKey, 'done'); setOpen(false); };
  if (!open || !steps[index]) return null;
  const step = steps[index];
  const last = index === steps.length - 1;
  return <aside className="fixed bottom-4 left-4 right-4 z-[80] rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl shadow-slate-950/20 sm:left-auto sm:right-6 sm:w-[380px]" aria-live="polite">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Recorrido {index + 1} de {steps.length}</p><h2 className="mt-1 text-base font-bold text-slate-950">{step.title}</h2></div><button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Cerrar recorrido"><X className="h-4 w-4" /></button></div>
    <p className="mt-2 text-sm leading-6 text-slate-600">{step.text}</p>
    <div className="mt-4 flex items-center justify-between"><button type="button" onClick={close} className="text-xs font-semibold text-slate-400 hover:text-slate-700">Omitir recorrido</button><button type="button" onClick={() => last ? close() : setIndex((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">{last ? <><Check className="h-4 w-4" />Finalizar</> : <>Siguiente<ArrowRight className="h-4 w-4" /></>}</button></div>
  </aside>;
}

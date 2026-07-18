import React, { useMemo } from 'react';
import type { AppData } from '../types';
import { calcularMétricasFinancieras } from '../lib/calculations';
import { ArrowRight, TrendingUp, Wallet, Clock, Users, Sparkles, CalendarCheck, Target } from 'lucide-react';
import { InsightsCard } from './SmartPlanner';

interface Props {
  appData: AppData;
  formatCop: (n: number) => string;
  onNavigate: (tab: string) => void;
  userName: string;
}

export default function Home({ appData, formatCop, onNavigate, userName }: Props) {
  const metrics = useMemo(() => calcularMétricasFinancieras(appData, 'Todos'), [appData]);

  const activeClients = appData.clientes.filter((c) => c.activo).length;
  const cash = metrics.utilidadNeta;
  const revenue = metrics.totalVentas;
  const hoursMonth = appData.horas
    .filter((h) => (h.fecha || '').startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, h) => s + (Number(h.horas) || 0), 0);

  const priorities: { title: string; hint: string; cta: string; tab: string }[] = [];
  if (cash < 0) priorities.push({ title: 'Flujo neto negativo este mes', hint: 'Revisa pagos y ajusta gastos.', cta: 'Ver Pagos', tab: 'pagosEgresos' });
  const overdueClients = appData.clientes.filter((c) => c.activo && (c as any).progreso < 40).length;
  if (overdueClients > 0) priorities.push({ title: `${overdueClients} proyectos con progreso bajo`, hint: 'Empuja o reactiva.', cta: 'Ver Proyectos', tab: 'proyectos' });
  if (activeClients === 0) priorities.push({ title: 'No hay clientes activos', hint: 'Activa clientes o revisa el pipeline.', cta: 'Ver Clientes', tab: 'clientes' });
  if (priorities.length === 0) priorities.push({ title: 'Todo en verde hoy', hint: 'Aprovecha para diseñar el siguiente movimiento.', cta: 'Planificar', tab: 'planner' });

  const kpis = [
    { label: 'Caja neta', value: formatCop(cash), icon: Wallet, tone: cash >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50' },
    { label: 'Ingresos', value: formatCop(revenue), icon: TrendingUp, tone: 'text-blue-700 bg-blue-50' },
    { label: 'Horas del mes', value: `${hoursMonth.toFixed(1)}h`, icon: Clock, tone: 'text-violet-700 bg-violet-50' },
    { label: 'Clientes activos', value: String(activeClients), icon: Users, tone: 'text-amber-700 bg-amber-50' },
  ];

  const quick = [
    { label: 'Planificador', tab: 'planner', icon: CalendarCheck, desc: 'Agenda tu día por energía' },
    { label: 'Proyectos', tab: 'proyectos', icon: Target, desc: 'Ejecución y KPIs' },
    { label: 'Ingresos', tab: 'ventas', icon: TrendingUp, desc: 'Ventas y abonos' },
    { label: 'Clientes', tab: 'clientes', icon: Users, desc: 'Cuentas y estado' },
    { label: 'Asistente IA', tab: '__ai', icon: Sparkles, desc: 'Pregunta al negocio' },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-sm text-slate-500">Buen día, {userName}</p>
        <h1 className="font-display text-3xl font-semibold text-slate-900 tracking-tight">Tu negocio, en una vista.</h1>
      </header>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Prioridades de hoy</h2>
        <ul className="space-y-2">
          {priorities.slice(0, 5).map((p, i) => (
            <li key={i} className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-white px-4 py-3.5 hover:border-blue-200 transition">
              <div>
                <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{p.hint}</p>
              </div>
              <button onClick={() => onNavigate(p.tab)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900">
                {p.cta} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Salud del negocio</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                <div className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${k.tone}`}><Icon className="h-4 w-4" /></div>
                <p className="mt-3 text-xs text-slate-500">{k.label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900 font-display">{k.value}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Acceso rápido</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {quick.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.tab}
                onClick={() => onNavigate(q.tab)}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-[var(--line)] bg-white p-4 text-left transition hover:border-blue-200 hover:shadow-sm"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-100">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{q.label}</p>
                  <p className="text-xs text-slate-500">{q.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

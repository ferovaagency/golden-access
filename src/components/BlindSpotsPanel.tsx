// Blind Spots panel — the "what you are probably not seeing" section.
// Groups findings by urgency and gives each a why / impact / action.

import React from 'react';
import { AlertTriangle, Check, Eye, Loader2, Sparkles, X } from 'lucide-react';
import { useBusinessIntel } from '../hooks/useBusinessIntel';
import type { BlindSpot, BlindSpotUrgency } from '../lib/biService';

const urgencyMeta: Record<BlindSpotUrgency, { label: string; tone: string; dot: string }> = {
  critical: { label: 'Crítico', tone: 'border-red-200 bg-red-50', dot: 'bg-red-500' },
  high: { label: 'Alto', tone: 'border-amber-200 bg-amber-50', dot: 'bg-amber-500' },
  medium: { label: 'Medio', tone: 'border-blue-200 bg-blue-50', dot: 'bg-blue-500' },
  low: { label: 'Oportunidad', tone: 'border-emerald-200 bg-emerald-50', dot: 'bg-emerald-500' },
};

interface Props { onNavigate?: (tab: string) => void }

export default function BlindSpotsPanel({ onNavigate }: Props) {
  const { blindspots, loading, busy, refreshBlindspots, dismiss, resolve, error } = useBusinessIntel();

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Lo que probablemente no estás viendo
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Detección automática sobre finanzas, CRM, proyectos y planner.</p>
        </div>
        <button
          onClick={refreshBlindspots}
          disabled={busy === 'blindspots'}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === 'blindspots' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Escanear ahora
        </button>
      </div>

      {error && <p className="mb-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading && blindspots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin text-slate-400" />
          Cargando…
        </div>
      ) : blindspots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-6 text-center">
          <p className="text-sm text-slate-600">Sin puntos ciegos detectados.</p>
          <p className="text-xs text-slate-400 mt-1">Cargá tus datos y presioná "Escanear ahora".</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {blindspots.map((b) => (
            <BlindSpotCard key={b.id} item={b} onNavigate={onNavigate} onDismiss={dismiss} onResolve={resolve} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BlindSpotCard({ item, onNavigate, onDismiss, onResolve }: { item: BlindSpot; onNavigate?: (tab: string) => void; onDismiss: (id: string) => void; onResolve: (id: string) => void }) {
  const meta = urgencyMeta[item.urgency];
  return (
    <li className={`rounded-2xl border ${meta.tone} px-4 py-3.5`}>
      <div className="flex items-start gap-3">
        <div className="mt-1.5 flex flex-col items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-slate-600">
              <AlertTriangle className="h-3 w-3" /> {meta.label}
            </span>
            {item.metric_value !== null && item.metric_label && (
              <span className="text-[10px] rounded-full bg-white border border-slate-200 px-2 py-0.5 text-slate-600">
                {item.metric_value} {item.metric_label}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-900">{item.title}</p>
          <div className="mt-2 grid gap-1.5 text-xs">
            <p className="text-slate-700"><span className="font-semibold text-slate-900">Por qué:</span> {item.why}</p>
            <p className="text-slate-700"><span className="font-semibold text-slate-900">Impacto:</span> {item.impact}</p>
            <p className="text-slate-700"><span className="font-semibold text-slate-900">Qué hacer:</span> {item.action}</p>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {item.action_route && onNavigate && (
              <button
                onClick={() => onNavigate(item.action_route!)}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
              >
                Actuar ahora
              </button>
            )}
            <button
              onClick={() => onResolve(item.id)}
              className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Check className="h-3 w-3" /> Ya lo resolví
            </button>
            <button
              onClick={() => onDismiss(item.id)}
              title="Descartar"
              className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-white px-2 py-1.5 text-[11px] text-slate-500 hover:bg-slate-50"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

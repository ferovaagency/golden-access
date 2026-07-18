// Business Health Score — visual gauge card. Sits at the top of Home so the
// entrepreneur sees the single number that matters, the delta vs. yesterday,
// and the two/three most important reasons behind it.

import React from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Loader2, Minus, RefreshCw } from 'lucide-react';
import { useBusinessIntel } from '../hooks/useBusinessIntel';

function toneFor(score: number): { text: string; bg: string; ring: string; label: string } {
  if (score >= 80) return { text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'stroke-emerald-500', label: 'Sólida' };
  if (score >= 65) return { text: 'text-blue-700', bg: 'bg-blue-50', ring: 'stroke-blue-500', label: 'Estable' };
  if (score >= 45) return { text: 'text-amber-700', bg: 'bg-amber-50', ring: 'stroke-amber-500', label: 'Frágil' };
  return { text: 'text-red-700', bg: 'bg-red-50', ring: 'stroke-red-500', label: 'En riesgo' };
}

export default function BusinessHealthCard() {
  const { health, loading, busy, refreshHealth, error } = useBusinessIntel();
  const score = health?.score ?? 0;
  const t = toneFor(score);
  const delta = health?.delta ?? 0;
  const DeltaIcon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  const deltaTone = delta > 0 ? 'text-emerald-700 bg-emerald-50' : delta < 0 ? 'text-red-700 bg-red-50' : 'text-slate-600 bg-slate-100';

  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (score / 100) * circumference;

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Business Health Score</p>
          <p className="text-sm text-slate-500 mt-1">Un número. Tu negocio de un vistazo.</p>
        </div>
        <button
          onClick={refreshHealth}
          disabled={busy === 'health'}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === 'health' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Recalcular
        </button>
      </div>

      {!health && !loading && (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--line)] p-6 text-center">
          <p className="text-sm text-slate-600">Todavía no calculás tu score.</p>
          <button
            onClick={refreshHealth}
            disabled={busy === 'health'}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === 'health' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Calcular ahora
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      )}

      {health && (
        <div className="mt-5 grid gap-6 md:grid-cols-[auto,1fr] items-center">
          <div className="relative h-32 w-32 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="46" strokeWidth="7" className="fill-none stroke-slate-100" />
              <circle
                cx="50" cy="50" r="46" strokeWidth="7" strokeLinecap="round"
                className={`fill-none transition-all ${t.ring}`}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className={`text-3xl font-semibold font-display ${t.text}`}>{score}</p>
                <p className="text-[10px] text-slate-500 -mt-0.5">/ 100</p>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${t.bg} ${t.text}`}>{t.label}</span>
              <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${deltaTone}`}>
                <DeltaIcon className="h-3 w-3" /> {delta === 0 ? 'sin cambios' : `${delta > 0 ? '+' : ''}${delta} pts`}
              </span>
              {health.snapshot_date && <span className="text-[11px] text-slate-400">Actualizado {new Date(health.computed_at).toLocaleString()}</span>}
            </div>

            {health.narrative && <p className="mt-2 text-sm text-slate-700">{health.narrative}</p>}

            {health.top_reasons?.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {health.top_reasons.slice(0, 4).map((r, i) => {
                  const isWeak = r.kind === 'weak';
                  return (
                    <div key={i} className={`rounded-xl border px-3 py-2 ${isWeak ? 'border-red-100 bg-red-50/40' : 'border-emerald-100 bg-emerald-50/40'}`}>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{isWeak ? 'Débil' : 'Fuerte'}</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">{r.label} <span className={isWeak ? 'text-red-700' : 'text-emerald-700'}>· {r.score}</span></p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{r.note}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

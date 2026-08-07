import { Calendar } from 'lucide-react';
import { type Period, periodPresets, samePeriod } from '../lib/period';

/**
 * Selector de período: atajos (este mes, trimestre, año, todo) + rango libre
 * día-a-día. Sustituye al antiguo <select> de mes.
 */
export function PeriodPicker({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const presets = periodPresets(new Date());
  const from = typeof period === 'string' ? '' : period.from;
  const to = typeof period === 'string' ? '' : period.to;

  const setRange = (nextFrom: string, nextTo: string) => {
    const f = nextFrom || nextTo;
    const t = nextTo || nextFrom;
    if (!f || !t) { onChange('Todos'); return; }
    onChange(f <= t ? { from: f, to: t } : { from: t, to: f });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="w-4 h-4 text-blue-600" />
      <span className="font-mono text-slate-500 text-[10px] uppercase font-bold tracking-wider">Período:</span>
      <div className="flex items-center gap-1">
        {presets.map((p) => {
          const active = samePeriod(period, p.period);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(p.period)}
              className={`rounded px-2.5 py-1 text-xs font-mono transition ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={from}
          onChange={(e) => setRange(e.target.value, to)}
          className="bg-slate-50 text-slate-900 border border-slate-200 text-xs p-1 rounded font-mono focus:outline-none focus:border-[#c9a961]"
          aria-label="Desde"
        />
        <span className="text-slate-400 text-xs">a</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setRange(from, e.target.value)}
          className="bg-slate-50 text-slate-900 border border-slate-200 text-xs p-1 rounded font-mono focus:outline-none focus:border-[#c9a961]"
          aria-label="Hasta"
        />
      </div>
    </div>
  );
}

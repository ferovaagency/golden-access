import { HelpCircle } from 'lucide-react';
import { getMetricDefinition } from '../../lib/metricsGlossary';

/**
 * Glosario contextual (Manual maestro, sección 3.3): envuelve un KPI y le
 * agrega un ícono de ayuda con definición simple, fórmula, y por qué
 * importa, al pasar el mouse. Puramente informativo -- nunca cambia el
 * valor mostrado por el padre.
 */
export function MetricTooltip({ code, dark = false }: { code: string; dark?: boolean }) {
  const def = getMetricDefinition(code);
  if (!def) return null;
  const statusLabel = { confirmado: 'Confirmado', estimado: 'Estimado', proyectado: 'Proyectado' }[def.status];
  return (
    <span className="relative inline-flex group align-middle ml-1">
      <HelpCircle className={`w-3 h-3 cursor-help ${dark ? 'text-[#8a8377]' : 'text-slate-400'}`} />
      <span className={`hidden group-hover:block absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 rounded-lg border p-3 text-[10px] leading-relaxed shadow-xl ${dark ? 'bg-[#0f0e0c] border-[#2a2620] text-[#a39d8e]' : 'bg-white border-slate-200 text-slate-600'}`}>
        <span className={`block font-semibold mb-1 ${dark ? 'text-[#e8e3d8]' : 'text-slate-900'}`}>{def.public_name} · <span className="font-normal">{statusLabel}</span></span>
        <span className="block mb-1.5">{def.simple_definition}</span>
        <span className="block font-mono opacity-80 mb-1.5">{def.formal_formula}</span>
        <span className="block italic opacity-90">{def.why_it_matters}</span>
      </span>
    </span>
  );
}

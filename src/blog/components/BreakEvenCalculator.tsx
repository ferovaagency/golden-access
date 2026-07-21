import { useMemo, useState } from 'react';

function parseNumber(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCop(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

/** Calculadora interactiva embebida en el articulo pilar de Rentabilidad -- unico interactivo real de esta primera tanda de contenido. */
export function BreakEvenCalculator() {
  const [fixedCosts, setFixedCosts] = useState('4000000');
  const [pricePerUnit, setPricePerUnit] = useState('120000');
  const [variableCostPerUnit, setVariableCostPerUnit] = useState('30000');

  const { margin, breakEvenUnits, breakEvenRevenue } = useMemo(() => {
    const fixed = parseNumber(fixedCosts);
    const price = parseNumber(pricePerUnit);
    const variableCost = parseNumber(variableCostPerUnit);
    const contributionMargin = price - variableCost;
    const units = contributionMargin > 0 ? Math.ceil(fixed / contributionMargin) : 0;
    return { margin: contributionMargin, breakEvenUnits: units, breakEvenRevenue: units * price };
  }, [fixedCosts, pricePerUnit, variableCostPerUnit]);

  return (
    <div className="not-prose mt-6 rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-soft)] p-5">
      <p className="font-display text-sm font-semibold text-[#1f1b16]">Calculadora de punto de equilibrio</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-[#57524a]">
          Costos fijos del mes
          <input
            value={fixedCosts}
            onChange={(e) => setFixedCosts(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] px-3 py-2 text-sm text-[#1f1b16]"
          />
        </label>
        <label className="text-xs text-[#57524a]">
          Precio por unidad/servicio
          <input
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] px-3 py-2 text-sm text-[#1f1b16]"
          />
        </label>
        <label className="text-xs text-[#57524a]">
          Costo variable por unidad
          <input
            value={variableCostPerUnit}
            onChange={(e) => setVariableCostPerUnit(e.target.value)}
            inputMode="numeric"
            className="mt-1 w-full rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] px-3 py-2 text-sm text-[#1f1b16]"
          />
        </label>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a39a8a]">Margen de contribución</p>
          <p className="mt-1 font-display text-lg font-semibold text-[#1f1b16]">{formatCop(margin)}</p>
        </div>
        <div className="rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a39a8a]">Unidades para el equilibrio</p>
          <p className="mt-1 font-display text-lg font-semibold text-[#1f1b16]">{breakEvenUnits}</p>
        </div>
        <div className="rounded-[var(--ferova-radius-control)] border border-[var(--ferova-brand)]/30 bg-[var(--ferova-ai)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#57524a]">Ingresos de equilibrio</p>
          <p className="mt-1 font-display text-lg font-semibold text-[var(--ferova-brand)]">{formatCop(breakEvenRevenue)}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[#8a8377]">Ejemplo educativo. Ferova One calcula esto automáticamente con tus datos reales y actualizados.</p>
    </div>
  );
}

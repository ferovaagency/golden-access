import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { AnimatedCard } from '../motion/AnimatedCard';

export interface KpiItem {
  key: string;
  label: string;
  value: number;
  format: (value: number) => string;
  detail: string;
  icon: LucideIcon;
}

interface KpiStripProps {
  items: KpiItem[];
  /** Identifica el periodo actual -- el conteo desde 0 solo ocurre la primera vez que se ve cada periodo. */
  periodKey: string;
}

function useCountUp(target: number, periodKey: string, reduce: boolean): number {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(target);
  const lastPeriodRef = useRef<string | null>(null);

  useEffect(() => {
    if (reduce) { motionValue.set(target); setDisplay(target); return; }
    const isFirstForPeriod = lastPeriodRef.current !== periodKey;
    lastPeriodRef.current = periodKey;
    const controls = animate(motionValue, target, { duration: isFirstForPeriod ? 0.9 : 0.3, ease: 'easeOut' });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, periodKey, reduce]);

  useMotionValueEvent(motionValue, 'change', (v) => setDisplay(v));
  return display;
}

function KpiCard({ item, periodKey, reduce }: { item: KpiItem; periodKey: string; reduce: boolean }) {
  const displayValue = useCountUp(item.value, periodKey, reduce);
  const Icon = item.icon;
  return (
    <AnimatedCard className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-4 shadow-[var(--ferova-shadow)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a39a8a]">{item.label}</p>
          <p className="mt-2 font-display text-xl font-semibold tracking-tight text-[#1f1b16] sm:text-2xl">{item.format(displayValue)}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--ferova-soft)] text-[var(--ferova-navy)]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-xs text-[#8a8377]">{item.detail}</p>
    </AnimatedCard>
  );
}

/** KPI strip del Executive Control Center. Cuenta desde 0 solo en la primera carga de cada periodo (manual, sec. 4). */
export function KpiStrip({ items, periodKey }: KpiStripProps) {
  const reduce = Boolean(useReducedMotion());
  return (
    <section aria-label="Indicadores clave" className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-5">
      {items.map((item) => (
        <KpiCard key={item.key} item={item} periodKey={periodKey} reduce={reduce} />
      ))}
    </section>
  );
}

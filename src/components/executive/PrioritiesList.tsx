import { CalendarCheck } from 'lucide-react';
import { AnimatedCard } from '../motion/AnimatedCard';
import type { Signal } from './types';

interface PrioritiesListProps {
  priorities: Signal[];
  onNavigate: (tab: string) => void;
}

/** Acciones con destino directo al modulo correcto -- misma lista `priorities` que ya arma Home.tsx. */
export function PrioritiesList({ priorities, onNavigate }: PrioritiesListProps) {
  return (
    <AnimatedCard className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-5 shadow-[var(--ferova-shadow)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a39a8a]">Hoy</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-[#1f1b16]">Prioridades</h3>
        </div>
        <CalendarCheck className="h-5 w-5 text-[var(--ferova-brand)]" />
      </div>
      <div className="mt-5 divide-y divide-[var(--ferova-line)]">
        {priorities.length ? priorities.map((priority) => (
          <div key={priority.title} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#1f1b16]">{priority.title}</p>
              <p className="mt-1 text-xs leading-5 text-[#8a8377]">{priority.detail}</p>
            </div>
            {priority.action && (
              <button onClick={() => onNavigate(priority.action!.tab)} className="shrink-0 text-xs font-semibold font-display text-[var(--ferova-navy)] hover:text-[var(--ferova-brand)]">
                {priority.action.label}
              </button>
            )}
          </div>
        )) : (
          <p className="py-4 text-sm text-[#8a8377]">Sin prioridades pendientes para este período.</p>
        )}
      </div>
    </AnimatedCard>
  );
}

import type { LucideIcon } from 'lucide-react';
import { AnimatedCard } from '../motion/AnimatedCard';

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  tab: string;
}

interface QuickActionsGridProps {
  actions: QuickAction[];
  onNavigate: (tab: string) => void;
}

/** Registrar venta, horas, proyecto y cliente -- mismo arreglo `quickActions` que ya arma Home.tsx. */
export function QuickActionsGrid({ actions, onNavigate }: QuickActionsGridProps) {
  return (
    <AnimatedCard className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-5 shadow-[var(--ferova-shadow)] sm:p-6">
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a39a8a]">Acceso rápido</p>
      <h3 className="mt-1 font-display text-lg font-semibold text-[#1f1b16]">Quick Actions</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map(({ label, icon: Icon, tab }) => (
          <button
            key={tab}
            onClick={() => onNavigate(tab)}
            className="flex min-h-24 flex-col items-start justify-between rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-3 text-left transition hover:border-[var(--ferova-brand)]/40 hover:bg-[var(--ferova-soft)]"
          >
            <Icon className="h-4 w-4 text-[var(--ferova-brand)]" />
            <span className="text-xs font-semibold text-[#57524a]">{label}</span>
          </button>
        ))}
      </div>
    </AnimatedCard>
  );
}

import { Sparkles } from 'lucide-react';
import { AnimatedCard } from '../motion/AnimatedCard';
import type { Signal } from './types';

interface ExecutiveBriefProps {
  health: Signal;
  topPriority?: Signal;
  onNavigate: (tab: string) => void;
}

/**
 * Explicacion narrativa de que cambio y que hacer -- se arma con las mismas
 * senales (health, priorities) que ya calcula Home.tsx, sin inventar datos
 * nuevos ni tocar los calculos financieros.
 */
export function ExecutiveBrief({ health, topPriority, onNavigate }: ExecutiveBriefProps) {
  return (
    <AnimatedCard className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-ai)] bg-[var(--ferova-ai)]/40 p-5 shadow-[var(--ferova-shadow)] sm:p-6">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--ferova-gold)]/15 text-[var(--ferova-gold)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <h3 className="font-display text-lg font-semibold text-[#1f1b16]">Executive Brief</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#57524a]">
        {health.detail} {topPriority ? `Lo más urgente ahora: ${topPriority.title.toLowerCase()} — ${topPriority.detail}` : 'No hay prioridades pendientes destacadas para este período.'}
      </p>
      {topPriority?.action && (
        <button
          onClick={() => onNavigate(topPriority.action!.tab)}
          className="mt-3 text-xs font-semibold font-display text-[var(--ferova-navy)] underline underline-offset-4 hover:text-[var(--ferova-brand)]"
        >
          {topPriority.action.label}
        </button>
      )}
    </AnimatedCard>
  );
}

import { HeartPulse } from 'lucide-react';
import { AnimatedCard } from '../motion/AnimatedCard';
import type { Signal, Tone } from './types';

const toneStyles: Record<Tone, { bg: string; text: string }> = {
  positive: { bg: 'var(--ferova-positive)', text: '#166534' },
  warning: { bg: 'var(--ferova-warning)', text: '#92400e' },
  critical: { bg: 'var(--ferova-danger)', text: '#991b1b' },
  neutral: { bg: 'var(--ferova-soft)', text: '#57524a' },
};

interface BusinessHealthProps {
  health: Signal;
  onNavigate: (tab: string) => void;
}

/** Indice visual de salud del negocio, basado en la misma senal `health` que ya calcula Home.tsx. */
export function BusinessHealth({ health, onNavigate }: BusinessHealthProps) {
  const style = toneStyles[health.tone];
  return (
    <AnimatedCard className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-5 shadow-[var(--ferova-shadow)] sm:p-6">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-[var(--ferova-brand)]" />
        <h3 className="font-display text-lg font-semibold text-[#1f1b16]">Business Health</h3>
      </div>
      <div className="mt-5 rounded-[var(--ferova-radius-control)] p-4" style={{ backgroundColor: style.bg }}>
        <p className="text-sm font-semibold" style={{ color: style.text }}>{health.title}</p>
        <p className="mt-1 text-xs leading-5 opacity-80" style={{ color: style.text }}>{health.detail}</p>
        {health.action && (
          <button onClick={() => onNavigate(health.action!.tab)} className="mt-3 text-xs font-semibold underline underline-offset-4" style={{ color: style.text }}>
            {health.action.label}
          </button>
        )}
      </div>
    </AnimatedCard>
  );
}

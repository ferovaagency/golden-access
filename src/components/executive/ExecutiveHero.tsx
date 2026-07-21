import { ArrowRight } from 'lucide-react';
import { AnimatedCard } from '../motion/AnimatedCard';

interface ExecutiveHeroProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

/** Hero ejecutivo del Executive Control Center: saludo, estado resumido, maximo dos CTA. */
export function ExecutiveHero({ eyebrow, title, subtitle, primaryAction, secondaryAction }: ExecutiveHeroProps) {
  return (
    <AnimatedCard
      hoverable={false}
      className="flex flex-col justify-between gap-4 rounded-[var(--ferova-radius-hero)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] px-5 py-6 shadow-[var(--ferova-shadow)] sm:px-7 sm:py-8 lg:flex-row lg:items-end"
    >
      <div>
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ferova-brand)]">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#1f1b16] sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8a8377]">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={primaryAction.onClick}
          className="inline-flex items-center justify-center gap-2 rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-4 py-2.5 text-sm font-medium font-display text-white transition hover:bg-[var(--ferova-brand-2)]"
        >
          {primaryAction.label} <ArrowRight className="h-4 w-4" />
        </button>
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--ferova-radius-pill)] border border-[var(--ferova-line)] px-4 py-2.5 text-sm font-medium font-display text-[#57524a] transition hover:bg-[var(--ferova-soft)]"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </AnimatedCard>
  );
}

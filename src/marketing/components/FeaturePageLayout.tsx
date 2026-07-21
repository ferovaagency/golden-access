import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { MarketingHeader } from './MarketingHeader';
import { MarketingFooter } from './MarketingFooter';
import { Reveal } from './Reveal';

interface FeaturePageLayoutProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  features: string[];
  /** Bloque visual (demo estatica fiel al producto, datos claramente de ejemplo). */
  demo: ReactNode;
  children: ReactNode;
}

/** Layout compartido de las 4 paginas /funciones/* -- cada una trae su propio copy y children (contenido especifico). */
export function FeaturePageLayout({ eyebrow, title, subtitle, features, demo, children }: FeaturePageLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      <MarketingHeader />

      <section className="border-b border-[var(--ferova-line)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-20 sm:px-6">
          <Reveal>
            <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ferova-brand)]">{eyebrow}</span>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#1f1b16] sm:text-4xl">{title}</h1>
            <p className="mt-4 text-base text-[#57524a]">{subtitle}</p>
            <ul className="mt-6 space-y-2">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-[#1f1b16]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ferova-brand)]" /> {feature}
                </li>
              ))}
            </ul>
            <Link to="/app" className="mt-8 inline-flex items-center gap-2 rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-6 py-3 font-medium font-display text-white hover:bg-[var(--ferova-brand-2)]">
              Crear mi cuenta <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <Reveal>{demo}</Reveal>
        </div>
      </section>

      {children}

      <MarketingFooter />
    </div>
  );
}

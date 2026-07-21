import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AnimatedCard } from '../motion/AnimatedCard';
import { StaggerGroup, StaggerItem } from '../motion/StaggerGroup';
import type { Signal } from './types';

interface BlindSpotsProps {
  spots: Signal[];
  onNavigate: (tab: string) => void;
}

/** Ventas ausentes, horas no registradas, equilibrio pendiente, etc. -- misma lista `blindSpots` que ya arma Home.tsx. */
export function BlindSpots({ spots, onNavigate }: BlindSpotsProps) {
  return (
    <AnimatedCard className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-5 shadow-[var(--ferova-shadow)] sm:p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-[var(--ferova-gold)]" />
        <h3 className="font-display text-lg font-semibold text-[#1f1b16]">Blind Spots</h3>
      </div>
      {spots.length ? (
        <StaggerGroup className="mt-4 space-y-3" staggerDelay={0.07}>
          {spots.map((spot) => (
            <StaggerItem key={spot.title}>
              <div className="flex items-start justify-between gap-3 rounded-[var(--ferova-radius-control)] bg-[var(--ferova-soft)] p-3">
                <div>
                  <p className="text-sm font-medium text-[#1f1b16]">{spot.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[#8a8377]">{spot.detail}</p>
                </div>
                {spot.action && (
                  <button onClick={() => onNavigate(spot.action!.tab)} className="shrink-0 text-xs font-semibold text-[var(--ferova-navy)]">
                    Abrir
                  </button>
                )}
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <div className="mt-4 rounded-[var(--ferova-radius-control)] p-4 text-sm" style={{ backgroundColor: 'var(--ferova-positive)', color: '#166534' }}>
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          No hay señales críticas para este período.
        </div>
      )}
    </AnimatedCard>
  );
}

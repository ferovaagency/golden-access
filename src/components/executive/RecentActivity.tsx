import type { LucideIcon } from 'lucide-react';
import { AnimatedCard } from '../motion/AnimatedCard';
import { StaggerGroup, StaggerItem } from '../motion/StaggerGroup';

export interface ActivityEntry {
  id: string;
  date: string;
  title: string;
  detail: string;
  icon: LucideIcon;
}

interface RecentActivityProps {
  entries: ActivityEntry[];
}

/** Timeline de ventas, horas y egresos -- misma lista `activity` que ya arma Home.tsx. */
export function RecentActivity({ entries }: RecentActivityProps) {
  return (
    <AnimatedCard className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-5 shadow-[var(--ferova-shadow)] sm:p-6">
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a39a8a]">Últimos movimientos</p>
      <h3 className="mt-1 font-display text-lg font-semibold text-[#1f1b16]">Recent Activity</h3>
      {entries.length ? (
        <StaggerGroup className="mt-4 divide-y divide-[var(--ferova-line)]" staggerDelay={0.05}>
          {entries.map(({ id, date, title, detail, icon: Icon }) => (
            <StaggerItem key={id}>
              <div className="flex items-center gap-3 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--ferova-soft)] text-[var(--ferova-navy)]">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#1f1b16]">{title}</p>
                  <p className="truncate text-xs text-[#8a8377]">{detail}</p>
                </div>
                <time className="shrink-0 text-[11px] font-medium text-[#a39a8a]">{date}</time>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <p className="py-6 text-center text-sm text-[#8a8377]">Aún no hay actividad registrada para este período.</p>
      )}
    </AnimatedCard>
  );
}

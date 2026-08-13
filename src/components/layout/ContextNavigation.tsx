import { Fragment } from 'react';
import type { NavigationItem } from './navigationTypes';

interface ContextNavigationProps {
  items: NavigationItem[];
  activeTab: string;
  onSelectItem: (id: string) => void;
  className?: string;
  variant?: 'horizontal' | 'vertical';
}

/**
 * Subnavegacion contextual: los items de la seccion activa, agrupados por
 * `group` (Finanzas/Planner/Ventas) cuando aplica. Vive en el area de
 * contenido, no anidada dentro del sidebar -- regla del manual: "no
 * desplegar todos los modulos simultaneamente".
 */
export function ContextNavigation({ items, activeTab, onSelectItem, className = '', variant = 'horizontal' }: ContextNavigationProps) {
  if (items.length === 0) return null;
  return (
    <nav className={`${variant === 'vertical' ? 'space-y-1' : 'flex flex-wrap items-center gap-1.5'} ${className}`} aria-label="Navegación de la sección">
      {items.map((item, index) => {
        const isActive = activeTab === item.id;
        const showGroupLabel = item.group && items.findIndex((candidate) => candidate.group === item.group) === index;
        return (
          <Fragment key={item.id}>
            {showGroupLabel && (
              <span className={variant === 'vertical' ? 'block px-3 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--fv-subtle)]' : 'ml-2 mr-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fv-subtle)] first:ml-0'}>
                {item.group}
              </span>
            )}
            <button
              onClick={() => onSelectItem(item.id)}
              title={item.hint}
              aria-current={isActive ? 'true' : undefined}
              className={`${variant === 'vertical' ? 'flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium' : 'rounded-[var(--ferova-radius-pill)] px-3.5 py-1.5 text-xs font-semibold font-display'} transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                : variant === 'vertical' ? 'text-[var(--fv-ink-2)] hover:bg-[var(--fv-soft)] hover:text-[var(--fv-ink)]' : 'bg-[var(--fv-surface)] text-[var(--fv-ink-2)] border border-[var(--fv-line)] hover:border-[var(--fv-brand)]/40 hover:text-[var(--fv-ink)]'
              }`}
            >
              {item.label}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}

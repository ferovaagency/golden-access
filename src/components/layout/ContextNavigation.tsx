import { Fragment } from 'react';
import { itemContains, itemTarget, type NavigationItem } from './navigationTypes';

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
    <nav className={`${variant === 'vertical' ? 'space-y-1' : 'inline-flex max-w-full flex-wrap items-center gap-1 rounded-[var(--fv-radius-lg)] bg-[var(--fv-soft)] p-1'} ${className}`} aria-label="Navegación de la sección">
      {items.map((item, index) => {
        const isActive = itemContains(item, activeTab);
        const showGroupLabel = item.group && items.findIndex((candidate) => candidate.group === item.group) === index;
        return (
          <Fragment key={item.id}>
            {showGroupLabel && (
              <span className={variant === 'vertical' ? 'block px-3 pb-1 pt-3 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--fv-subtle)]' : 'ml-2 mr-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fv-subtle)] first:ml-0'}>
                {item.group}
              </span>
            )}
            <button
              onClick={() => onSelectItem(itemTarget(item))}
              title={item.hint}
              data-tour={`tab-${item.id}`}
              aria-current={isActive ? 'true' : undefined}
              className={`${variant === 'vertical' ? 'flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium' : 'rounded-[var(--fv-radius-sm)] px-3 py-1.5 text-[13px] font-medium'} transition-colors ${
                variant === 'vertical'
                  ? isActive ? 'bg-[var(--fv-monolith)] text-white' : 'text-[var(--fv-ink-2)] hover:bg-[var(--fv-soft)] hover:text-[var(--fv-ink)]'
                  : isActive ? 'bg-[var(--fv-surface)] font-semibold text-[var(--fv-ink)] shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-[var(--fv-line)]' : 'text-[var(--fv-ink-2)] hover:text-[var(--fv-ink)]'
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

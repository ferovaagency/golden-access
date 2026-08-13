import type { NavigationSection } from './navigationTypes';

interface PrimaryNavigationProps {
  sections: NavigationSection[];
  activeSectionId: string;
  onSelectSection: (section: NavigationSection) => void;
  className?: string;
  collapsed?: boolean;
}

/**
 * Riel de secciones principales (Home, Workspace, Modules, Settings...).
 * Presentacional puro: no conoce modules/isTeam/permisos, solo recibe la
 * lista ya filtrada. Al elegir seccion, App.tsx navega al primer item --
 * los items en si viven en ContextNavigation, no aqui (regla de
 * subnavegacion del manual: no desplegar todos los modulos a la vez).
 */
export function PrimaryNavigation({ sections, activeSectionId, onSelectSection, className = '', collapsed = false }: PrimaryNavigationProps) {
  return (
    <nav className={`space-y-1 ${className}`} aria-label="Navegación principal">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = section.id === activeSectionId;
        return (
          <button
            key={section.id}
            onClick={() => onSelectSection(section)}
            aria-current={isActive ? 'true' : undefined}
            title={collapsed ? section.label : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-[var(--ferova-brand)] text-white shadow-sm'
                : 'text-[var(--fv-ink-2)] hover:bg-[var(--fv-soft)] hover:text-[var(--fv-ink)]'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className={collapsed ? 'sr-only' : 'truncate'}>{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

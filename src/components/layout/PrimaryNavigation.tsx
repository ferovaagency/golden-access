import type { NavigationSection } from './navigationTypes';

interface PrimaryNavigationProps {
  sections: NavigationSection[];
  activeSectionId: string;
  onSelectSection: (section: NavigationSection) => void;
  className?: string;
}

/**
 * Riel de secciones principales (Home, Workspace, Modules, Settings...).
 * Presentacional puro: no conoce modules/isTeam/permisos, solo recibe la
 * lista ya filtrada. Al elegir seccion, App.tsx navega al primer item --
 * los items en si viven en ContextNavigation, no aqui (regla de
 * subnavegacion del manual: no desplegar todos los modulos a la vez).
 */
export function PrimaryNavigation({ sections, activeSectionId, onSelectSection, className = '' }: PrimaryNavigationProps) {
  return (
    <nav className={`space-y-1.5 ${className}`} aria-label="Navegación principal">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = section.id === activeSectionId;
        return (
          <button
            key={section.id}
            onClick={() => onSelectSection(section)}
            aria-current={isActive ? 'true' : undefined}
            className={`flex w-full items-center gap-3 rounded-[var(--ferova-radius-control)] px-3 py-3 text-left text-sm font-semibold font-display transition-colors ${
              isActive
                ? 'bg-[var(--ferova-brand)] text-white shadow-sm'
                : 'text-[#57524a] hover:bg-[var(--ferova-soft)] hover:text-[#1f1b16]'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

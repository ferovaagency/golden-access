import { Fragment, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { HelpCircle, X } from 'lucide-react';
import { WorkspaceHeader } from './WorkspaceHeader';
import { PrimaryNavigation } from './PrimaryNavigation';
import { ContextNavigation } from './ContextNavigation';
import type { NavigationSection } from './navigationTypes';

interface AppShellProps {
  sections: NavigationSection[];
  activeSectionId: string;
  activeTab: string;
  onNavigateTab: (tabId: string) => void;
  user: User;
  onSignOut: () => void;
  headerExtras?: ReactNode;
  topBar?: ReactNode;
  periodBar?: ReactNode;
  aiSidebar?: ReactNode;
  footer?: ReactNode;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
  /** Contenido del modulo activo -- App.tsx ya arma el mismo Suspense/switch que usa el shell actual. */
  children: ReactNode;
}

/**
 * Shell v2 (Manual_Implementacion_Diseno_Ferova_One, Fase 2). Puramente de
 * composicion: recibe secciones, tab activo y callbacks ya resueltos por
 * App.tsx -- no reimplementa permisos, auth ni el switch de modulos. Vive
 * detras de VITE_FEROVA_UI_V2; el shell actual sigue siendo el default.
 */
export function AppShell({
  sections, activeSectionId, activeTab, onNavigateTab, user, onSignOut,
  headerExtras, topBar, periodBar, aiSidebar, footer,
  mobileMenuOpen, onToggleMobileMenu, onCloseMobileMenu, children,
}: AppShellProps) {
  const activeSection = sections.find((section) => section.id === activeSectionId);

  return (
    <div className="ferova-v2-theme min-h-screen bg-[var(--ferova-canvas)] font-sans text-[#1f1b16]">
      <div className="lg:hidden"><WorkspaceHeader user={user} onSignOut={onSignOut} mobileMenuOpen={mobileMenuOpen} onToggleMobileMenu={onToggleMobileMenu} extras={headerExtras} /></div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#1f1b16]/35 backdrop-blur-sm lg:hidden" onClick={onCloseMobileMenu}>
          <aside
            className="h-full w-[min(88vw,360px)] overflow-y-auto bg-[var(--ferova-surface)] p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            aria-label="Navegación móvil"
          >
            <div className="mb-4 flex items-center justify-between border-b border-[var(--ferova-line)] pb-4">
              <p className="font-display text-sm font-semibold text-[#1f1b16]">Menú</p>
              <button onClick={onCloseMobileMenu} className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ferova-soft)] text-[#57524a]" aria-label="Cerrar menú">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-3">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = section.id === activeSectionId;
                return (
                  <section key={section.id} className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] p-2">
                    <button
                      onClick={() => section.items[0] && onNavigateTab(section.items[0].id)}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold font-display ${
                        isActive ? 'bg-[var(--ferova-brand)] text-white' : 'text-[#57524a] hover:bg-[var(--ferova-soft)]'
                      }`}
                    >
                      <Icon className="h-4 w-4" /> {section.label}
                    </button>
                    {isActive && (
                      <div className="space-y-1 pt-2">
                        {section.items.map((item, index) => (
                          <Fragment key={item.id}>
                            {item.group && section.items.findIndex((candidate) => candidate.group === item.group) === index && (
                              <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a39a8a] first:pt-1">{item.group}</p>
                            )}
                            <button
                              onClick={() => onNavigateTab(item.id)}
                              className={`min-h-11 w-full rounded-xl px-3 py-2 text-left ${
                                activeTab === item.id ? 'bg-[var(--ferova-ai)] text-[var(--ferova-navy)]' : 'text-[#57524a] hover:bg-[var(--ferova-soft)]'
                              }`}
                            >
                              <span className="block text-xs font-semibold">{item.label}</span>
                              <span className="block text-[11px] opacity-70">{item.hint}</span>
                            </button>
                          </Fragment>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[var(--ferova-line)] bg-[var(--ferova-surface)] lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-[var(--ferova-line)] px-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--ferova-brand)] font-display text-sm font-bold text-white">F</div>
          <div><p className="font-display text-sm font-semibold tracking-tight text-[var(--ferova-ink)]">Ferova One</p><p className="text-[9px] uppercase tracking-[.14em] text-[#9b968f]">Business OS</p></div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.16em] text-[#aaa49c]">Navegación</p>
          <PrimaryNavigation
            sections={sections}
            activeSectionId={activeSectionId}
            onSelectSection={(section) => section.items[0] && onNavigateTab(section.items[0].id)}
          />
          {activeSection && activeSection.items.length > 1 && (
            <div className="mt-4 border-t border-[var(--ferova-line)] pt-3">
              <ContextNavigation items={activeSection.items} activeTab={activeTab} onSelectItem={onNavigateTab} variant="vertical" />
            </div>
          )}
        </div>
        <div className="border-t border-[var(--ferova-line)] p-3"><button type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-[#77716a] hover:bg-[var(--ferova-soft)]"><HelpCircle className="h-4 w-4" /> Ayuda</button></div>
      </aside>

      <div className="min-h-screen lg:pl-60">
        {topBar}
        {periodBar}
        <div className="flex w-full min-w-0 flex-1 gap-4 px-3 pb-5 sm:px-5">
          <main className="min-w-0 flex-1">
            {children}
          </main>
          {aiSidebar}
        </div>
        {footer}
      </div>
    </div>
  );
}

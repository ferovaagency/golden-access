import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { LogOut, Menu, User as UserIcon, X } from 'lucide-react';

interface WorkspaceHeaderProps {
  user: User;
  onSignOut: () => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  /** TRM, clientes activos, respaldo Sheets, toggle IA, feedback -- lo que hoy vive en el header, sin moverle la logica. */
  extras?: ReactNode;
}

/**
 * Topbar sticky (72-76px) del shell v2: marca, slot de extras (widgets que
 * siguen viviendo -- y calculando su estado -- en App.tsx), chip de perfil
 * y el trigger del menu movil. Puramente presentacional.
 */
export function WorkspaceHeader({ user, onSignOut, mobileMenuOpen, onToggleMobileMenu, extras }: WorkspaceHeaderProps) {
  const displayName = (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || 'Mafe';
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--ferova-line)] bg-[var(--ferova-canvas)]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--ferova-brand)] font-display font-bold uppercase text-white shadow-sm">
            F
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-display text-base font-bold tracking-tight text-[#1f1b16]">Ferova One</h1>
            <span className="hidden text-xs text-[#8a8377] sm:block">Tu sistema operativo de negocio</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {extras}

          <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-1.5 pr-3.5 shadow-sm">
            <div className="grid h-7 w-7 place-items-center rounded-xl border border-[var(--ferova-brand)]/20 bg-[var(--ferova-brand)]/10">
              <UserIcon className="h-3.5 w-3.5 text-[var(--ferova-brand)]" />
            </div>
            <div className="hidden text-left text-[10px] leading-tight md:block">
              <span className="block font-semibold text-[#1f1b16]">{displayName}</span>
              <span className="block max-w-40 truncate font-mono text-[9px] text-[#a39a8a]">{user.email}</span>
            </div>
            <button
              onClick={onSignOut}
              title="Cerrar sesión"
              className="ml-1 rounded border border-[var(--ferova-line)] bg-[var(--ferova-soft)]/60 p-1.5 text-[#a39a8a] transition hover:text-[var(--ferova-brand)]"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            onClick={onToggleMobileMenu}
            className="rounded border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-2 text-[#8a8377] lg:hidden"
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}

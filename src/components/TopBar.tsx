import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { Search, Command as CommandIcon, LogOut, UserRound, Sparkles } from 'lucide-react';
import NotificationsBell from './NotificationsBell';

type Props = {
  userId: string;
  onOpenPalette: () => void;
  onNavigate: (tab: string) => void;
  user?: User;
  extras?: ReactNode;
  /** Selector de empresa activa. Va aparte de `extras` porque NO se oculta en
   *  pantallas pequeñas: es navegación, no un accesorio — sin él, quien tiene
   *  varias empresas no puede llegar a las demás. */
  workspaceSwitcher?: ReactNode;
  onSignOut?: () => void;
  onOpenAssistant?: () => void;
};

export default function TopBar({ userId, onOpenPalette, onNavigate, user, extras, workspaceSwitcher, onSignOut, onOpenAssistant }: Props) {
  const displayName = (user?.user_metadata as any)?.full_name || (user?.user_metadata as any)?.name || user?.email?.split('@')[0] || 'Usuario';
  return (
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6">
        <button
          onClick={onOpenPalette}
          className="flex min-h-9 w-[320px] min-w-[140px] max-w-full shrink items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400 transition hover:border-slate-300 hover:bg-white hover:text-slate-700"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Buscar o ejecutar…</span>
          <kbd className="flex items-center gap-0.5 text-[10px] font-mono border border-slate-200 rounded px-1 py-0.5">
            <CommandIcon className="w-2.5 h-2.5" />K
          </kbd>
        </button>
        {workspaceSwitcher && <div className="min-w-0 shrink-0">{workspaceSwitcher}</div>}
        <div className="flex min-w-0 items-center gap-2">
          {/* `2xl` (1536px) los escondía en la práctica siempre: el propio
              contenedor está limitado a 1500px, así que en cualquier portátil
              normal el TRM, el registro rápido de horas y el feedback no
              aparecían nunca. Desde `lg` se ven, y cada extra decide por su
              cuenta si se oculta en pantallas más pequeñas. */}
          {extras && <div className="hidden min-w-0 items-center gap-2 lg:flex">{extras}</div>}
          {onOpenAssistant && (
            <button type="button" onClick={onOpenAssistant} title="Abrir asistente IA" className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" /><span className="hidden sm:inline">Asistente</span>
            </button>
          )}
          <NotificationsBell userId={userId} onNavigate={onNavigate} />
          {user && (
            <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-3">
              <button type="button" onClick={() => onNavigate('ajustes')} title="Configuración de la cuenta" className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-slate-100">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--ferova-soft)] text-[var(--ferova-brand)]"><UserRound className="h-4 w-4" /></span>
                <div className="hidden max-w-28 leading-tight text-left xl:block">
                  <p className="truncate text-[11px] font-semibold text-slate-800">{displayName}</p>
                  <p className="truncate text-[9px] text-slate-400">{user.email}</p>
                </div>
              </button>
              {onSignOut && <button type="button" onClick={onSignOut} aria-label="Cerrar sesión" title="Cerrar sesión" className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[var(--ferova-brand)]"><LogOut className="h-3.5 w-3.5" /></button>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

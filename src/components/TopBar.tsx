import { ProfileMenu } from './layout/ProfileMenu';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { Search, Command as CommandIcon, Sparkles, Compass } from 'lucide-react';
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
          <button type="button" onClick={() => window.dispatchEvent(new Event('ferova:start-tour'))} title="Ver recorrido guiado con el Copiloto" aria-label="Ver recorrido guiado" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-amber-300 hover:text-amber-600"><Compass className="h-3.5 w-3.5" /></button>
          {onOpenAssistant && (
            <button type="button" onClick={onOpenAssistant} data-tour="ai-toggle" title="Abrir asistente IA" className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" /><span className="hidden sm:inline">Asistente</span>
            </button>
          )}
          <NotificationsBell userId={userId} onNavigate={onNavigate} />
          {user && <ProfileMenu user={user} onNavigate={onNavigate} onSignOut={onSignOut} />}
        </div>
      </div>
    </div>
  );
}



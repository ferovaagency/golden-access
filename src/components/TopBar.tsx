import React from 'react';
import { Search, Command as CommandIcon } from 'lucide-react';
import NotificationsBell from './NotificationsBell';

type Props = {
  userId: string;
  onOpenPalette: () => void;
  onNavigate: (tab: string) => void;
};

export default function TopBar({ userId, onOpenPalette, onNavigate }: Props) {
  return (
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-3 flex items-center justify-between gap-3">
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 transition text-xs w-[280px] max-w-full"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Buscar o ejecutar…</span>
          <kbd className="flex items-center gap-0.5 text-[10px] font-mono border border-slate-200 rounded px-1 py-0.5">
            <CommandIcon className="w-2.5 h-2.5" />K
          </kbd>
        </button>
        <div className="flex items-center gap-2">
          <NotificationsBell userId={userId} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

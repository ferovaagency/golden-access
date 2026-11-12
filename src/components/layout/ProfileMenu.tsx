import { useEffect, useRef, useState } from "react";
import { CreditCard, LogOut, Settings, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
export function ProfileMenu({
  user,
  onNavigate,
  onSignOut,
}: {
  user: User;
  onNavigate: (tab: string) => void;
  onSignOut?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", click);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", click);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const choose = (tab: string) => {
    setOpen(false);
    onNavigate(tab);
  };
  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        aria-label="Mi perfil"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <UserRound className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Mi perfil</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user.user_metadata?.full_name || user.email?.split("@")[0] || "Mi cuenta"}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <div className="p-1.5">
            <button role="menuitem" onClick={() => choose("ajustes")} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><Settings className="h-4 w-4 text-slate-400" /> Configuración del negocio</button>
            <button role="menuitem" onClick={() => choose("plan")} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><CreditCard className="h-4 w-4 text-slate-400" /> Plan y suscripción</button>
          </div>
          {onSignOut && (
            <div className="border-t border-slate-100 p-1.5">
              <button role="menuitem" onClick={() => { setOpen(false); onSignOut(); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" /> Cerrar sesión</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

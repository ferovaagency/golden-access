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
    <div ref={root} className="profile-menu">
      <button
        ref={trigger}
        type="button"
        className="profile-trigger"
        aria-label="Mi perfil"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <UserRound size={18} />
        <span className="hidden xl:inline">Mi perfil</span>
      </button>
      {open && (
        <div className="profile-options">
          <strong>
            {user.user_metadata?.full_name || user.email?.split("@")[0] || "Mi cuenta"}
          </strong>
          <span>{user.email}</span>
          <button onClick={() => choose("plan")}>
            <CreditCard size={16} /> Administrar mi suscripción
          </button>
          <button onClick={() => choose("ajustes")}>
            <Settings size={16} /> Configuración
          </button>
          {onSignOut && (
            <button
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          )}
        </div>
      )}
    </div>
  );
}

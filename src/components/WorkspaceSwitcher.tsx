import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Users } from 'lucide-react';
import type { WorkspaceOption } from '../lib/organizationsService';

// Selector de empresa activa. Cambiar aquí cambia la cuenta sobre la que opera
// toda la aplicación (finanzas, CRM, Planner, asistente).
// Ver docs/DISENO_ORGANIZACIONES.md.

interface Props {
  options: WorkspaceOption[];
  active: WorkspaceOption;
  onSelect: (key: string) => void;
}

const ETIQUETA: Record<WorkspaceOption['kind'], string> = {
  propia: 'Tu negocio',
  organizacion: 'Del holding',
  colaboracion: 'Invitación',
};

export default function WorkspaceSwitcher({ options, active, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Con una sola cuenta el selector sobra: no hay nada entre qué elegir.
  if (options.length < 2) return null;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex max-w-56 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-left shadow-sm transition hover:border-slate-300"
        title="Cambiar de empresa"
      >
        <Building2 className="h-3.5 w-3.5 shrink-0 text-blue-600" />
        <span className="min-w-0 truncate text-xs font-semibold text-slate-900">{active.nombre}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((o) => {
            const selected = o.key === active.key;
            return (
              <button
                key={o.key}
                role="option"
                aria-selected={selected}
                onClick={() => { onSelect(o.key); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50 ${selected ? 'bg-blue-50/60' : ''}`}
              >
                {o.kind === 'colaboracion'
                  ? <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  : <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-900">{o.nombre}</span>
                  <span className="block text-[10px] text-slate-400">{ETIQUETA[o.kind]}</span>
                </span>
                {selected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

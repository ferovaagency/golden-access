import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ArrowRight, Command as CommandIcon, Zap, LayoutGrid, FileText, CalendarCheck, Users, Wallet, Target, MessageCircle, Star, Sparkles } from 'lucide-react';

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  group: 'Navegar' | 'Acciones' | 'CRM' | 'Finanzas';
  icon?: any;
  keywords?: string;
  run: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  isTeam: boolean;
  hasFinance: boolean;
  onOpenAI?: () => void;
  onOpenNotifications?: () => void;
};

export default function CommandPalette({ open, onClose, onNavigate, isTeam, hasFinance, onOpenAI, onOpenNotifications }: Props) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: CommandItem[] = useMemo(() => {
    const go = (id: string) => () => { onNavigate(id); onClose(); };
    const base: CommandItem[] = [
      { id: 'nav:home', label: 'Ir a Home', group: 'Navegar', icon: LayoutGrid, run: go('home') },
      { id: 'nav:planner', label: 'Planificador', group: 'Navegar', icon: CalendarCheck, run: go('planner') },
      { id: 'nav:reports', label: 'Reportes CEO', group: 'Navegar', icon: FileText, run: go('reports') },
      { id: 'nav:proyectos', label: 'Proyectos', group: 'Navegar', icon: LayoutGrid, run: go('proyectos') },
    ];
    if (hasFinance) {
      base.push(
        { id: 'nav:dashboard', label: 'Finanzas · Dashboard', group: 'Finanzas', icon: Wallet, run: go('dashboard') },
        { id: 'nav:ventas', label: 'Ingresos', group: 'Finanzas', icon: Wallet, run: go('ventas') },
        { id: 'nav:gastos', label: 'Costos', group: 'Finanzas', icon: Wallet, run: go('gastos') },
        { id: 'nav:horas', label: 'Horas', group: 'Finanzas', icon: Wallet, run: go('horas') },
        { id: 'nav:clientes', label: 'Clientes', group: 'Finanzas', icon: Users, run: go('clientes') },
        { id: 'nav:iva', label: 'IVA', group: 'Finanzas', icon: Wallet, run: go('iva') },
        { id: 'nav:equilibrioGlobal', label: 'Punto de equilibrio', group: 'Finanzas', icon: Target, run: go('equilibrioGlobal') },
        { id: 'nav:ajustes', label: 'Configuración', group: 'Navegar', icon: LayoutGrid, run: go('ajustes') },
      );
    }
    if (isTeam) {
      base.push(
        { id: 'nav:pipeline', label: 'CRM · Pipeline', group: 'CRM', icon: Target, run: go('crm-pipeline') },
        { id: 'nav:citas', label: 'CRM · Citas', group: 'CRM', icon: CalendarCheck, run: go('crm-citas') },
        { id: 'nav:contenido', label: 'CRM · LinkedIn + Reddit', group: 'CRM', icon: Sparkles, run: go('crm-contenido') },
        { id: 'nav:bot', label: 'CRM · Bot WhatsApp', group: 'CRM', icon: MessageCircle, run: go('crm-bot') },
        { id: 'nav:resenas', label: 'CRM · Reseñas', group: 'CRM', icon: Star, run: go('crm-resenas') },
      );
    }
    base.push(
      { id: 'act:ai', label: 'Preguntar a la IA ejecutiva', group: 'Acciones', icon: Sparkles, hint: 'Abre el asistente', run: () => { onOpenAI?.(); onClose(); } },
      { id: 'act:notifs', label: 'Ver notificaciones y puntos ciegos', group: 'Acciones', icon: Zap, run: () => { onOpenNotifications?.(); onClose(); } },
      { id: 'act:report', label: 'Generar reporte CEO ahora', group: 'Acciones', icon: FileText, run: go('reports') },
    );
    return base;
  }, [isTeam, hasFinance, onNavigate, onClose, onOpenAI, onOpenNotifications]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(i => (i.label + ' ' + (i.keywords || '') + ' ' + i.group).toLowerCase().includes(s));
  }, [q, items]);

  useEffect(() => { setIdx(0); }, [q, open]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setQ('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(filtered.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); filtered[idx]?.run(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, idx, onClose]);

  if (!open) return null;

  // Group items visually
  const grouped: Record<string, CommandItem[]> = {};
  filtered.forEach(i => { (grouped[i.group] = grouped[i.group] || []).push(i); });

  let running = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar o ejecutar una acción…"
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
          />
          <kbd className="text-[10px] font-mono text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-slate-400">Sin resultados</p>
          )}
          {Object.entries(grouped).map(([group, list]) => (
            <div key={group} className="mb-1">
              <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
              {list.map((i) => {
                running++;
                const active = running === idx;
                const Icon = i.icon || ArrowRight;
                return (
                  <button
                    key={i.id}
                    onMouseEnter={() => setIdx(running)}
                    onClick={() => i.run()}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm transition ${active ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="flex-1 truncate">{i.label}</span>
                    {i.hint && <span className="text-[11px] text-slate-400">{i.hint}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 px-4 py-2 flex items-center justify-between text-[10px] text-slate-400 bg-slate-50">
          <span className="flex items-center gap-1"><CommandIcon className="w-3 h-3" /> K para abrir en cualquier momento</span>
          <span>↑↓ navegar · ↵ ejecutar</span>
        </div>
      </div>
    </div>
  );
}

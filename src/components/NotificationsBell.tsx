import React, { useEffect, useMemo, useState } from 'react';
import { Bell, AlertTriangle, TrendingDown, Zap, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Notif = {
  id: string;
  title: string;
  detail?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  advice?: string;
  createdAt: string;
};

type Props = { userId: string; onNavigate?: (tab: string) => void };

const READ_KEY = 'ferova.notif.read';

export default function NotificationsBell({ userId, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [readSet, setReadSet] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); }
  });

  const persistRead = (s: Set<string>) => {
    setReadSet(new Set(s));
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(s)));
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('business_blindspots')
        .select('id, title, detail, urgency, category, advice, created_at, resolved')
        .eq('user_id', userId)
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(20);
      if (cancelled) return;
      setItems(((data as any[]) || []).map(r => ({
        id: r.id,
        title: r.title,
        detail: r.detail,
        urgency: r.urgency,
        category: r.category,
        advice: r.advice,
        createdAt: r.created_at,
      })));
    })();
    return () => { cancelled = true; };
  }, [userId, open]);

  const unread = useMemo(() => items.filter(i => !readSet.has(i.id)).length, [items, readSet]);

  const urgencyStyles: Record<string, { bg: string; text: string; icon: any }> = {
    critical: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', icon: AlertTriangle },
    high: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: TrendingDown },
    medium: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: Zap },
    low: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600', icon: CheckCircle2 },
  };

  const markAllRead = () => persistRead(new Set(items.map(i => i.id)));
  const markOne = (id: string) => { const s = new Set(readSet); s.add(id); persistRead(s); };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition"
        title="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold grid place-items-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-[360px] max-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-900">Notificaciones inteligentes</p>
                <p className="text-[11px] text-slate-400">Detectadas por Ferova OS</p>
              </div>
              <div className="flex items-center gap-1.5">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[11px] text-blue-600 hover:underline">Marcar leído</button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Todo tranquilo</p>
                  <p className="text-[11px] text-slate-400 mt-1">Sin puntos ciegos activos</p>
                </div>
              )}
              {items.map(n => {
                const st = urgencyStyles[n.urgency] || urgencyStyles.low;
                const Icon = st.icon;
                const isRead = readSet.has(n.id);
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition ${isRead ? 'opacity-60' : ''}`}
                    onClick={() => { markOne(n.id); onNavigate?.('home'); setOpen(false); }}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`rounded-lg border p-1.5 ${st.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${st.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{n.title}</p>
                          {!isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                        </div>
                        {n.detail && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.detail}</p>}
                        {n.advice && <p className="text-[11px] text-blue-700 mt-1 line-clamp-2">→ {n.advice}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Sparkles, PanelRightClose, PanelRightOpen, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Conversation, ConversationContent } from './ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from './ai-elements/message';
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from './ai-elements/prompt-input';
import { Shimmer } from './ai-elements/shimmer';
import { AiDisclosure } from './AiDisclosure';

interface Props {
  user: User;
  collapsed: boolean;
  onToggle: () => void;
  width: number;
  onResize: (w: number) => void;
  currentArea?: string;
}

function getText(message: UIMessage): string {
  return (message.parts || []).map((p: any) => p.type === 'text' ? p.text : '').join('');
}

export default function AISidebar({ user, collapsed, onToggle, width, onResize, currentArea }: Props) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('business_assistant_messages')
        .select('id, role, parts, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(80);
      if (cancelled) return;
      const mapped = (data || []).reverse().map((m: any) => ({
        id: m.id,
        role: m.role,
        parts: Array.isArray(m.parts) && m.parts.length ? m.parts : [{ type: 'text', text: m.content || '' }],
      })) as UIMessage[];
      setInitialMessages(mapped);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/business-assistant-chat`,
    fetch: async (input, init) => {
      const { data } = await supabase.auth.getSession();
      const headers = new Headers(init?.headers);
      if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
      if (currentArea) headers.set('X-Ferova-Context-Area', currentArea);
      return fetch(input, { ...init, headers });
    },
  }), [currentArea]);

  const { messages, setMessages, sendMessage, status, stop, error } = useChat({
    id: `business-assistant-${user.id}`,
    transport,
  });

  useEffect(() => { if (loaded) setMessages(initialMessages); }, [loaded, initialMessages, setMessages]);
  useEffect(() => { if (!collapsed) setTimeout(() => textareaRef.current?.focus(), 80); }, [collapsed, status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || status === 'submitted' || status === 'streaming') return;
    setInput('');
    await sendMessage({ text });
    textareaRef.current?.focus();
  };

  const clearHistory = async () => {
    const { error: deleteError } = await (supabase as any)
      .from('business_assistant_messages')
      .delete()
      .eq('user_id', user.id);
    if (deleteError) return;
    setMessages([]);
    setInitialMessages([]);
  };

  const onDragStart = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startW: width };
    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startX - ev.clientX;
      onResize(Math.min(640, Math.max(320, dragRef.current.startW + delta)));
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (collapsed) {
    return (
      <aside className="fixed right-0 top-1/2 z-40 flex w-12 -translate-y-1/2 flex-col items-center rounded-l-2xl border border-r-0 border-[var(--line)] bg-white py-4 shadow-lg lg:static lg:translate-y-0 lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-none">
        <button onClick={onToggle} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Abrir asistente IA">
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <div className="mt-3 grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <Sparkles className="h-4 w-4" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed inset-y-2 right-2 z-40 flex w-[min(380px,calc(100vw-1rem))] flex-col rounded-2xl border border-[var(--line)] bg-white shadow-2xl lg:static lg:inset-auto lg:w-auto lg:rounded-none lg:border-y-0 lg:border-r-0 lg:shadow-none" style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? width : undefined }}>
      <div
        onMouseDown={onDragStart}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-200/60"
        title="Arrastra para redimensionar"
      />
      <header className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 font-display">Asistente Ferova</h2>
            <p className="text-[11px] text-slate-500">{currentArea ? `Contexto: ${currentArea}` : 'Contexto de tu negocio'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearHistory} className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" title="Borrar conversación" aria-label="Borrar conversación">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onToggle} className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" title="Colapsar" aria-label="Colapsar asistente">
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col px-3">
        <div className="pt-3"><AiDisclosure variant="banner" /></div>
        <Conversation>
          <ConversationContent>
            {!loaded && <Shimmer>Cargando historial…</Shimmer>}
            {loaded && messages.length === 0 && (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                Preguntame por rentabilidad, pipeline, reseñas, clientes, gastos o el siguiente paso del negocio.
              </div>
            )}
            {messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent from={m.role}>
                  <MessageResponse>{getText(m)}</MessageResponse>
                  {m.role === 'assistant' && <AiDisclosure />}
                </MessageContent>
              </Message>
            ))}
            {status === 'submitted' && <Shimmer>Pensando con datos del negocio…</Shimmer>}
            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
          </ConversationContent>
        </Conversation>

        <div className="pb-3">
          <PromptInput onSubmit={submit}>
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntame sobre tu negocio…"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e as any); }}
            />
            <PromptInputFooter className="justify-between">
              <span className="text-[10px] text-slate-400">Solo responde con tus datos reales.</span>
              <PromptInputSubmit status={status} disabled={!input.trim()} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </aside>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Bot, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Conversation, ConversationContent } from './ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from './ai-elements/message';
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from './ai-elements/prompt-input';
import { Shimmer } from './ai-elements/shimmer';

interface Props {
  user: User;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const ASSISTANT_AREAS = ['Projects', 'Clients', 'Finance', 'CRM', 'Planner', 'Hours', 'Integrations'];

function getText(message: UIMessage): string {
  return (message.parts || []).map((part: any) => part.type === 'text' ? part.text : '').join('');
}

export default function BusinessAssistant({ user, collapsed, onToggleCollapsed }: Props) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('business_assistant_messages')
        .select('id, role, parts, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      const mapped = (data || []).map((message: any) => ({
        id: message.id,
        role: message.role,
        parts: Array.isArray(message.parts) && message.parts.length ? message.parts : [{ type: 'text', text: message.content || '' }],
      })) as UIMessage[];
      setInitialMessages(mapped);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/business-assistant-chat`,
    fetch: async (request, init) => {
      const { data } = await supabase.auth.getSession();
      const headers = new Headers(init?.headers);
      if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
      return fetch(request, { ...init, headers });
    },
  }), []);

  const { messages, setMessages, sendMessage, status, stop, error } = useChat({
    id: `business-assistant-${user.id}`,
    transport,
  });

  useEffect(() => {
    if (loaded) setMessages(initialMessages);
  }, [loaded, initialMessages, setMessages]);

  useEffect(() => {
    if (!collapsed) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [collapsed, status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || status === 'submitted' || status === 'streaming') return;
    setInput('');
    await sendMessage({ text });
    textareaRef.current?.focus();
  };

  if (collapsed) {
    return (
      <aside className="fixed right-0 top-0 z-40 flex h-dvh w-14 flex-col items-center border-l border-slate-200 bg-white/95 py-5 shadow-xl backdrop-blur">
        <button
          onClick={onToggleCollapsed}
          className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
          aria-label="Expandir asistente"
          title="Expandir asistente"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <div className="mt-5 flex flex-1 items-center">
          <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Assistant</span>
        </div>
        <Bot className="h-5 w-5 text-blue-600" aria-hidden="true" />
      </aside>
    );
  }

  return (
    <aside className="fixed bottom-2 right-2 top-2 z-40 flex w-[min(360px,calc(100vw-1rem))] flex-col rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur xl:bottom-0 xl:right-0 xl:top-0 xl:w-[360px] xl:rounded-none xl:border-y-0 xl:border-r-0">
      <header className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">Asistente Ferova</h2>
            <p className="text-xs text-slate-500">Contexto operativo disponible</p>
          </div>
        </div>
        <button onClick={onToggleCollapsed} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Colapsar asistente" title="Colapsar asistente">
          <PanelRightClose className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 py-3" aria-label="Areas de contexto del asistente">
        {ASSISTANT_AREAS.map((area) => (
          <span key={area} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{area}</span>
        ))}
      </div>

      <Conversation>
        <ConversationContent>
          {!loaded && <Shimmer>Cargando historial...</Shimmer>}
          {loaded && messages.length === 0 && (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Consultame por prioridades, proyectos, clientes, finanzas, CRM, horas o integraciones. Te respondere breve y con una accion recomendada.
            </div>
          )}
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent from={message.role}>
                <MessageResponse>{getText(message)}</MessageResponse>
              </MessageContent>
            </Message>
          ))}
          {status === 'submitted' && <Shimmer>Pensando con datos del negocio...</Shimmer>}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
        </ConversationContent>
      </Conversation>

      <PromptInput onSubmit={submit}>
        <PromptInputTextarea
          ref={textareaRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ej: Que deberia priorizar hoy?"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) submit(event as any);
          }}
        />
        <PromptInputFooter className="justify-between">
          <span className="text-xs text-slate-400">Respuestas breves, basadas en datos cargados.</span>
          <PromptInputSubmit status={status} disabled={!input.trim()} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>
    </aside>
  );
}

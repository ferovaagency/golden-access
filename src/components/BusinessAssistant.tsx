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
  open: boolean;
  onToggle: () => void;
}

function getText(message: UIMessage): string {
  return (message.parts || []).map((part: any) => part.type === 'text' ? part.text : '').join('');
}

export default function BusinessAssistant({ user, open, onToggle }: Props) {
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
      const mapped = (data || []).map((m: any) => ({
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
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  }), []);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: `business-assistant-${user.id}`,
    messages: initialMessages,
    transport,
  });

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [open, status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || status === 'submitted' || status === 'streaming') return;
    setInput('');
    await sendMessage({ text });
    textareaRef.current?.focus();
  };

  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-blue-700"
      >
        <Bot className="h-4 w-4" /> Asistente Ferova
      </button>
    );
  }

  return (
    <aside className="fixed bottom-4 right-4 top-4 z-40 flex w-[min(440px,calc(100vw-2rem))] flex-col rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <header className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">Asistente Ferova</h2>
            <p className="text-xs text-slate-500">Contexto real de finanzas, CRM, reseñas y servicios</p>
          </div>
        </div>
        <button onClick={onToggle} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Cerrar asistente">
          <PanelRightClose className="h-4 w-4" />
        </button>
      </header>

      <Conversation>
        <ConversationContent>
          {!loaded && <Shimmer>Cargando historial...</Shimmer>}
          {loaded && messages.length === 0 && (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Preguntame por rentabilidad, pipeline, reseñas pendientes, clientes, gastos o próximos pasos del negocio.
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
          placeholder="Ej: ¿Qué servicio es más rentable y por qué?"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) submit(event as any);
          }}
        />
        <PromptInputFooter className="justify-between">
          <span className="text-xs text-slate-400">No inventa: responde solo con datos cargados.</span>
          <PromptInputSubmit status={status} disabled={!input.trim()} onStop={stop} />
        </PromptInputFooter>
      </PromptInput>
    </aside>
  );
}
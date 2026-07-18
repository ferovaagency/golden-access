import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Sparkles, CheckCircle2, Circle, PenLine } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BusinessProfile, getBusinessProfile, upsertBusinessProfile, skipOnboarding } from '../lib/businessProfileService';
import { Conversation, ConversationContent } from './ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from './ai-elements/message';
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from './ai-elements/prompt-input';
import { Shimmer } from './ai-elements/shimmer';
import { AiDisclosure } from './AiDisclosure';

interface Props {
  user: User;
  onDone: (profile: BusinessProfile) => void;
}

const CHECKLIST: { field: keyof BusinessProfile; label: string; required: boolean }[] = [
  { field: 'nombre_negocio', label: 'Nombre del negocio', required: true },
  { field: 'industria', label: 'Industria / sector', required: true },
  { field: 'tipo_negocio', label: 'Tipo de negocio', required: true },
  { field: 'tamano_equipo', label: 'Tamaño del equipo', required: true },
  { field: 'ciudad', label: 'Ciudad', required: false },
  { field: 'telefono_contacto', label: 'Teléfono de contacto', required: false },
];

function getText(message: UIMessage): string {
  return (message.parts || []).map((part: any) => part.type === 'text' ? part.text : '').join('');
}

export default function OnboardingChat({ user, onDone }: Props) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState('');
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualForm, setManualForm] = useState<Record<string, string>>({});
  const [savingManual, setSavingManual] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const refreshProfile = async () => {
    try {
      const p = await getBusinessProfile(user.id);
      setProfile(p);
      if (p?.onboarding_completado) onDone(p);
    } catch (err) {
      console.error('[OnboardingChat] refreshProfile error:', err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data }] = await Promise.all([
        (supabase as any)
          .from('onboarding_messages')
          .select('id, role, parts, content, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }),
        refreshProfile(),
      ]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-chat`,
    fetch: async (input, init) => {
      const { data } = await supabase.auth.getSession();
      const headers = new Headers(init?.headers);
      if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
      return fetch(input, { ...init, headers });
    },
  }), []);

  const { messages, setMessages, sendMessage, status, stop, error } = useChat({
    id: `onboarding-${user.id}`,
    transport,
    onFinish: () => { refreshProfile(); },
  });

  useEffect(() => {
    if (loaded) setMessages(initialMessages);
  }, [loaded, initialMessages, setMessages]);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, [status]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || status === 'submitted' || status === 'streaming') return;
    setInput('');
    await sendMessage({ text });
    textareaRef.current?.focus();
  };

  const handleSkip = async () => {
    if (!confirm('¿Seguro que quieres saltar esto? Puedes completar los datos de tu negocio más tarde desde Ajustes.')) return;
    const saved = await skipOnboarding(user.id);
    onDone(saved);
  };

  const openManualForm = () => {
    setManualForm({
      nombre_negocio: profile?.nombre_negocio || '',
      industria: profile?.industria || '',
      tipo_negocio: profile?.tipo_negocio || '',
      tamano_equipo: profile?.tamano_equipo || '',
      ciudad: profile?.ciudad || '',
      telefono_contacto: profile?.telefono_contacto || '',
    });
    setManualMode(true);
  };

  const handleManualSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingManual(true);
    try {
      const completado = CHECKLIST.filter((c) => c.required).every((c) => (manualForm[c.field] || '').trim());
      const saved = await upsertBusinessProfile(user.id, { ...manualForm, onboarding_completado: completado } as any);
      setProfile(saved);
      if (completado) onDone(saved);
      else setManualMode(false);
    } catch (err: any) {
      alert(`Error guardando: ${err.message || err}`);
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid lg:grid-cols-[280px_1fr] gap-4 sm:gap-6">
        {/* Checklist lateral */}
        <aside className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 order-2 lg:order-1">
          <div className="flex items-center gap-2 text-slate-900">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h2 className="font-display font-semibold text-sm">Configuremos tu negocio</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Unas preguntas rápidas para que tu asistente y tus reportes hablen de TU negocio, no de datos genéricos.
          </p>
          <ul className="space-y-2">
            {CHECKLIST.map((c) => {
              const done = !!profile?.[c.field];
              return (
                <li key={c.field} className="flex items-center gap-2 text-xs">
                  {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 shrink-0" />}
                  <span className={done ? 'text-slate-700' : 'text-slate-400'}>{c.label}{!c.required && ' (opcional)'}</span>
                </li>
              );
            })}
          </ul>
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <button onClick={openManualForm} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 py-2 rounded-xl border border-blue-100 hover:bg-blue-50">
              <PenLine className="w-3.5 h-3.5" /> Prefiero llenarlo yo mismo
            </button>
            <button onClick={handleSkip} className="w-full text-xs text-slate-400 hover:text-slate-600 py-1.5">
              Saltar por ahora
            </button>
          </div>
        </aside>

        {/* Chat o formulario manual */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col min-h-[520px] order-1 lg:order-2">
          <AiDisclosure variant="banner" />
          {manualMode ? (
            <form onSubmit={handleManualSave} className="space-y-4">
              <h3 className="font-display font-semibold text-slate-900">Datos de tu negocio</h3>
              {CHECKLIST.map((c) => (
                <div key={c.field}>
                  <label htmlFor={`onb-${c.field}`} className="block text-xs font-semibold text-slate-600 mb-1">
                    {c.label}{!c.required && ' (opcional)'}
                  </label>
                  <input
                    id={`onb-${c.field}`}
                    value={manualForm[c.field] || ''}
                    onChange={(e) => setManualForm({ ...manualForm, [c.field]: e.target.value })}
                    required={c.required}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900"
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={savingManual} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50">
                  {savingManual ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setManualMode(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm">
                  Volver al chat
                </button>
              </div>
            </form>
          ) : (
            <>
              <Conversation>
                <ConversationContent>
                  {!loaded && <Shimmer>Cargando...</Shimmer>}
                  {loaded && messages.length === 0 && (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                      ¡Hola! Vamos a configurar tu negocio con un par de preguntas rápidas. Puedes escribir tu respuesta abajo cuando quieras.
                    </div>
                  )}
                  {messages.map((message) => (
                    <Message key={message.id} from={message.role}>
                      <MessageContent from={message.role}>
                        <MessageResponse>{getText(message)}</MessageResponse>
                      </MessageContent>
                    </Message>
                  ))}
                  {status === 'submitted' && <Shimmer>Escribiendo...</Shimmer>}
                  {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
                </ConversationContent>
              </Conversation>

              <PromptInput onSubmit={submit}>
                <PromptInputTextarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Escribe tu respuesta..."
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) submit(event as any);
                  }}
                />
                <PromptInputFooter className="justify-between">
                  <span className="text-xs text-slate-400">Solo preguntamos lo básico de tu negocio.</span>
                  <PromptInputSubmit status={status} disabled={!input.trim()} onStop={stop} />
                </PromptInputFooter>
              </PromptInput>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

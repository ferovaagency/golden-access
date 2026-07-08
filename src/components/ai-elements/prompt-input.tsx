import React from 'react';
import { Send, Square } from 'lucide-react';

export function PromptInput({ children, onSubmit, className = '' }: React.PropsWithChildren<{ onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void; className?: string }>) {
  return <form onSubmit={onSubmit} className={`rounded-2xl border border-slate-200 bg-white p-2 shadow-sm ${className}`}>{children}</form>;
}

export const PromptInputTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function PromptInputTextarea(props, ref) {
  return <textarea ref={ref} {...props} className={`block min-h-20 w-full resize-none rounded-xl border-0 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 ${props.className || ''}`} />;
});

export function PromptInputFooter({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`flex items-center border-t border-slate-100 px-2 pt-2 ${className}`}>{children}</div>;
}

export function PromptInputSubmit({ status, disabled, onStop }: { status?: string; disabled?: boolean; onStop?: () => void }) {
  const loading = status === 'submitted' || status === 'streaming';
  return (
    <button
      type={loading ? 'button' : 'submit'}
      onClick={loading ? onStop : undefined}
      disabled={disabled && !loading}
      className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={loading ? 'Detener respuesta' : 'Enviar mensaje'}
    >
      {loading ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
    </button>
  );
}
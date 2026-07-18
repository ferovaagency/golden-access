import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { MessageSquarePlus, X, CheckCircle2 } from 'lucide-react';
import { submitFeedback, FeedbackTipo } from '../lib/feedbackService';

interface Props {
  user: User;
}

export default function FeedbackWidget({ user }: Props) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<FeedbackTipo>('sugerencia');
  const [mensaje, setMensaje] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const close = () => {
    setOpen(false);
    setTimeout(() => { setSent(false); setMensaje(''); setTipo('sugerencia'); }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensaje.trim()) return;
    setSubmitting(true);
    try {
      await submitFeedback(user.id, user.email || null, tipo, mensaje.trim());
      setSent(true);
    } catch (err: any) {
      alert(`No se pudo enviar: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-40 grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-lg hover:bg-slate-50 md:static md:flex md:h-auto md:w-auto md:items-center md:gap-2 md:px-3 md:py-2 md:text-xs md:font-semibold md:shadow-sm"
        aria-label="Enviar feedback"
        title="Reportar un problema o enviar una sugerencia"
      >
        <MessageSquarePlus className="w-4 h-4" /> <span className="hidden md:inline">Reportar / Sugerir</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={close}>
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-slate-900">¿Algo que reportar o sugerir?</h2>
              <button onClick={close} className="text-slate-400 hover:text-slate-900" aria-label="Cerrar">
                <X className="w-4 h-4" />
              </button>
            </div>

            {sent ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm text-slate-700">¡Gracias! Ya lo recibimos y lo vamos a revisar.</p>
                <button onClick={close} className="text-xs font-semibold text-blue-600 hover:text-blue-700">Cerrar</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="fb-tipo" className="block text-xs font-semibold text-slate-600 mb-1">Tipo</label>
                  <select
                    id="fb-tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as FeedbackTipo)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900"
                  >
                    <option value="bug">Algo no funciona bien</option>
                    <option value="sugerencia">Tengo una sugerencia</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="fb-mensaje" className="block text-xs font-semibold text-slate-600 mb-1">Cuéntanos</label>
                  <textarea
                    id="fb-mensaje"
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                    required
                    rows={4}
                    placeholder="Describe lo que pasó o lo que te gustaría que tuviera la plataforma..."
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-sm text-slate-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !mensaje.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

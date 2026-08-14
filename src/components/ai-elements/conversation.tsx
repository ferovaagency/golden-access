import React from 'react';
import { ArrowDown } from 'lucide-react';

// Distancia (px) desde el fondo dentro de la cual se considera que la persona
// "está al final". No es 0 a propósito: con scroll suave, tipografías que
// cargan tarde o un margen de más, el navegador deja sobras de unos pocos
// píxeles y el botón parpadearía sin motivo.
const MARGEN_FONDO = 48;

interface ConversationCtxValue {
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  alFinal: boolean;
  bajarAlFinal: (behavior?: ScrollBehavior) => void;
  onScroll: () => void;
}

const ConversationCtx = React.createContext<ConversationCtxValue | null>(null);

export function Conversation({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [alFinal, setAlFinal] = React.useState(true);
  // Espejo en ref: lo lee el observador de mutaciones, que vive fuera del
  // ciclo de render y con el estado leería siempre el valor del primer render.
  const alFinalRef = React.useRef(true);

  const onScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cerca = el.scrollHeight - el.scrollTop - el.clientHeight <= MARGEN_FONDO;
    alFinalRef.current = cerca;
    setAlFinal((previo) => (previo === cerca ? previo : cerca));
  }, []);

  const bajarAlFinal = React.useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Seguir la conversación mientras crece, PERO sólo si ya estabas al final.
  // Si subiste a releer algo, la respuesta que llega no te arrastra: para eso
  // está el botón. `characterData` incluye el texto que llega token a token.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof MutationObserver === 'undefined') return;
    const observador = new MutationObserver(() => {
      if (alFinalRef.current) el.scrollTo({ top: el.scrollHeight });
      else onScroll();
    });
    observador.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observador.disconnect();
  }, [onScroll]);

  const valor = React.useMemo(
    () => ({ scrollRef, alFinal, bajarAlFinal, onScroll }),
    [alFinal, bajarAlFinal, onScroll],
  );

  return (
    <ConversationCtx.Provider value={valor}>
      <div className={`relative flex min-h-0 flex-1 flex-col ${className}`}>{children}</div>
    </ConversationCtx.Provider>
  );
}

export function ConversationContent({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
  const ctx = React.useContext(ConversationCtx);
  return (
    <div
      ref={ctx?.scrollRef}
      onScroll={ctx?.onScroll}
      className={`min-h-0 flex-1 space-y-5 overflow-y-auto px-1 py-4 ${className}`}
    >
      {children}
    </div>
  );
}

/** Aparece sólo cuando te has ido hacia arriba; al final, estorba. */
export function ConversationScrollButton({ className = '' }: { className?: string }) {
  const ctx = React.useContext(ConversationCtx);
  if (!ctx || ctx.alFinal) return null;
  return (
    <button
      type="button"
      onClick={() => ctx.bajarAlFinal()}
      aria-label="Bajar al final de la conversación"
      className={`absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-md transition hover:bg-slate-50 hover:text-slate-900 ${className}`}
    >
      <ArrowDown className="h-3.5 w-3.5" />
      Bajar al final
    </button>
  );
}

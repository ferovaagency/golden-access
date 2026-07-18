import { useState } from 'react';
import { Info, X } from 'lucide-react';

type AiDisclosureVariant = 'inline' | 'banner' | 'report';

const TEXTS: Record<AiDisclosureVariant, string> = {
  inline: 'Respuesta automatizada; puede usar inteligencia artificial cuando esté disponible. Verifica las cifras antes de decidir.',
  banner: 'Estás usando un asistente automatizado que analiza los datos registrados en Ferova One y puede usar inteligencia artificial cuando esté disponible. Verifica siempre las cifras. No sustituye asesoría contable, tributaria ni legal.',
  report: 'Documento generado automáticamente a partir de los datos registrados; puede usar inteligencia artificial cuando esté disponible. Es una simulación, no una proyección certificada ni asesoría financiera.',
};

const DISMISS_KEY = 'ferova.aiDisclosure.bannerDismissed';

export function AiDisclosure({ variant = 'inline' }: { variant?: AiDisclosureVariant }) {
  const text = TEXTS[variant];
  const [dismissed, setDismissed] = useState(
    () => variant === 'banner' && typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1',
  );

  if (variant === 'inline') {
    return <p className="mt-2 text-[11px] leading-snug text-slate-500" role="note">{text}</p>;
  }

  if (variant === 'banner' && dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600"
        title={text}
      >
        <Info className="h-3 w-3" /> Aviso sobre IA
      </button>
    );
  }

  return (
    <div role="note" className="relative rounded-xl border border-amber-200 bg-amber-50 py-1.5 pl-3 pr-7 text-[11px] leading-snug text-amber-950">
      {text}
      {variant === 'banner' && (
        <button
          type="button"
          onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); }}
          className="absolute right-1.5 top-1.5 rounded p-0.5 text-amber-700 hover:bg-amber-100"
          aria-label="Minimizar aviso"
          title="Minimizar (siempre puedes volver a abrirlo)"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

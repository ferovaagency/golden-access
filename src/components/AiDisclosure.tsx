type AiDisclosureVariant = 'inline' | 'banner' | 'report';

const TEXTS: Record<AiDisclosureVariant, string> = {
  inline: 'Respuesta automatizada; puede usar inteligencia artificial cuando esté disponible. Verifica las cifras antes de decidir.',
  banner: 'Estás usando un asistente automatizado que analiza los datos registrados en Ferova One y puede usar inteligencia artificial cuando esté disponible. Verifica siempre las cifras. No sustituye asesoría contable, tributaria ni legal.',
  report: 'Documento generado automáticamente a partir de los datos registrados; puede usar inteligencia artificial cuando esté disponible. Es una simulación, no una proyección certificada ni asesoría financiera.',
};

export function AiDisclosure({ variant = 'inline' }: { variant?: AiDisclosureVariant }) {
  const text = TEXTS[variant];

  if (variant === 'inline') {
    return <p className="mt-2 text-[11px] leading-snug text-slate-500" role="note">{text}</p>;
  }

  return (
    <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-950">
      {text}
    </div>
  );
}

type AiDisclosureVariant = 'inline' | 'banner' | 'report';

const TEXTS: Record<AiDisclosureVariant, string> = {
  inline: 'Respuesta generada con inteligencia artificial. Puede contener errores: verifica las cifras antes de decidir.',
  banner: 'Estás usando un asistente de inteligencia artificial. Analiza los datos que registraste en Ferova OS para darte recomendaciones. Puede equivocarse: verifica siempre las cifras antes de tomar una decisión. No sustituye asesoría contable, tributaria ni legal.',
  report: 'Documento generado automáticamente con inteligencia artificial a partir de los datos que registraste. Es una simulación, no una proyección certificada ni asesoría financiera. Las decisiones son tuyas.',
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

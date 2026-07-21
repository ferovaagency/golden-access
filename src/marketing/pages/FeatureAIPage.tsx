import { Link } from 'react-router-dom';
import { Target, TrendingUp, ShieldCheck } from 'lucide-react';
import { SeoHead } from '../../seo/SeoHead';
import { breadcrumbSchema, softwareApplicationSchema } from '../../seo/StructuredData';
import { FeaturePageLayout } from '../components/FeaturePageLayout';
import { Reveal } from '../components/Reveal';

export default function FeatureAIPage() {
  return (
    <>
      <SeoHead
        title="Asistente empresarial con contexto"
        description="Un asistente de IA que lee tus finanzas, tu CRM y tu agenda reales, no un chatbot genérico. Cada respuesta parte de los datos de tu negocio."
        path="/funciones/asistente-ia"
        jsonLd={[
          softwareApplicationSchema(),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Producto', path: '/funciones' }, { name: 'Asistente IA', path: '/funciones/asistente-ia' }]),
        ]}
      />
      <FeaturePageLayout
        eyebrow="Asistente IA"
        title="Asistente empresarial con contexto"
        subtitle="No es un chat genérico. El asistente lee tus finanzas, tu CRM y tu agenda, y te dice qué está fallando antes de que lo notes."
        features={[
          'Usa el área en la que estás trabajando como contexto automático',
          'Nunca ejecuta acciones sin tu confirmación',
          'Respuestas basadas en tus datos reales, no en generalidades',
          'Historial, streaming y colapso — siempre disponible, nunca invasivo',
        ]}
        demo={
          <div className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-4 shadow-[var(--ferova-shadow)]">
            <div className="space-y-3">
              <div className="rounded-[var(--ferova-radius-control)] bg-[var(--ferova-soft)] p-3 text-sm text-[#57524a]">
                <span className="font-medium text-[#1f1b16]">Vos:</span> ¿Cómo vamos este mes?
              </div>
              <div className="rounded-[var(--ferova-radius-control)] p-3 text-sm" style={{ backgroundColor: 'var(--ferova-ai)' }}>
                <span className="font-medium text-[var(--ferova-gold)]">IA:</span>{' '}
                <span className="text-[#1f1b16]">Ingresos +12% vs. septiembre, pero <b>3 oportunidades</b> del CRM llevan más de 7 días sin movimiento. ¿Te preparo el seguimiento?</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8a8377]">
                <Target className="h-3.5 w-3.5" /> Proactivo · <TrendingUp className="h-3.5 w-3.5" /> Contextual · <ShieldCheck className="h-3.5 w-3.5" /> Privado
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-[#a39a8a]">Datos de demostración</p>
          </div>
        }
      >
        <section className="border-t border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-[#1f1b16]">La diferencia entre un chatbot y un asistente contextual</h2>
              <p className="mt-3 text-[#57524a]">
                Cualquier chatbot puede explicarte cómo se calcula un punto de equilibrio. Solo un asistente con contexto real puede decirte
                cuál es <em>tu</em> punto de equilibrio, hoy, con tus datos actualizados.
              </p>
              <p className="mt-3 text-sm text-[#8a8377]">
                Lee más en{' '}
                <Link to="/blog/ia-contextual-vs-chatbot" className="font-medium text-[var(--ferova-brand)] underline">
                  IA contextual vs. chatbot genérico
                </Link>
                .
              </p>
            </Reveal>
          </div>
        </section>
      </FeaturePageLayout>
    </>
  );
}

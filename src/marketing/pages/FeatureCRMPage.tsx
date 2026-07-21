import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { SeoHead } from '../../seo/SeoHead';
import { breadcrumbSchema, softwareApplicationSchema } from '../../seo/StructuredData';
import { FeaturePageLayout } from '../components/FeaturePageLayout';
import { Reveal } from '../components/Reveal';

const LEADS = [
  { n: 'Nova Studio', s: 'Propuesta enviada', temp: 'Caliente' },
  { n: 'Marca Alfa', s: 'Esperando decisión', temp: 'Tibio' },
  { n: 'Ecomm Delta', s: 'Primer contacto', temp: 'Frío' },
];

export default function FeatureCRMPage() {
  return (
    <>
      <SeoHead
        title="CRM para emprendedores y small business"
        description="Pipeline simple, seguimiento y enriquecimiento de prospectos para que ninguna oportunidad se enfríe por falta de sistema."
        path="/funciones/crm"
        jsonLd={[
          softwareApplicationSchema(),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Producto', path: '/funciones' }, { name: 'CRM', path: '/funciones/crm' }]),
        ]}
      />
      <FeaturePageLayout
        eyebrow="CRM"
        title="CRM para emprendedores y small business"
        subtitle="Un pipeline simple que se actualiza de verdad, con IA que avisa cuándo una oportunidad lleva demasiados días sin movimiento."
        features={[
          'Etapas mínimas: nada de campos que nadie usa',
          'Alertas de oportunidades sin seguimiento',
          'Enriquecimiento de prospectos y outreach generado por IA',
          'Conectado con Finanzas y Proyectos, sin duplicar datos',
        ]}
        demo={
          <div className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-4 shadow-[var(--ferova-shadow)]">
            <div className="space-y-2">
              {LEADS.map((l) => (
                <div key={l.n} className="flex items-center justify-between rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-canvas)] p-3">
                  <div>
                    <div className="font-medium text-[#1f1b16]">{l.n}</div>
                    <div className="text-xs text-[#8a8377]">{l.s}</div>
                  </div>
                  <span className="rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-soft)] px-2 py-0.5 text-xs text-[#57524a]">{l.temp}</span>
                </div>
              ))}
              <button type="button" className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-[var(--ferova-radius-control)] bg-[var(--ferova-brand)] px-3 py-2 text-sm font-display text-white">
                <Zap className="h-4 w-4" /> Generar outreach con IA
              </button>
            </div>
            <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-[#a39a8a]">Datos de demostración</p>
          </div>
        }
      >
        <section className="border-t border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-[#1f1b16]">Un CRM que un equipo de una o dos personas realmente usa</h2>
              <p className="mt-3 text-[#57524a]">
                Los CRM diseñados para equipos grandes tienen más campos de los que un negocio chico necesita. Ferova One usa las etapas mínimas
                que evitan perder oportunidades, sin la fricción de mantener actualizado un sistema complejo.
              </p>
              <p className="mt-3 text-sm text-[#8a8377]">
                Lee más en{' '}
                <Link to="/blog/crm-simple-etapas" className="font-medium text-[var(--ferova-brand)] underline">
                  CRM simple: etapas mínimas para no perder oportunidades
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

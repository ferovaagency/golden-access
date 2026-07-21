import { Link } from 'react-router-dom';
import { SeoHead } from '../../seo/SeoHead';
import { breadcrumbSchema, softwareApplicationSchema } from '../../seo/StructuredData';
import { FeaturePageLayout } from '../components/FeaturePageLayout';
import { Reveal } from '../components/Reveal';

const BLOCKS = [
  { t: '09:00', label: 'Focus profundo — Cerrar propuesta Nova', tag: 'Energía alta' },
  { t: '11:00', label: 'Llamada Mariana (CRM warm)', tag: 'Reunión' },
  { t: '14:00', label: 'Admin ligera — Facturar octubre', tag: 'Energía baja' },
];

export default function FeaturePlannerPage() {
  return (
    <>
      <SeoHead
        title="Planificación empresarial con IA"
        description="Brain dump, priorización por energía y bloques protegidos: un planner que organiza tu día según cuándo realmente rendís, no solo según fechas límite."
        path="/funciones/planner"
        jsonLd={[
          softwareApplicationSchema(),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Producto', path: '/funciones' }, { name: 'Planner', path: '/funciones/planner' }]),
        ]}
      />
      <FeaturePageLayout
        eyebrow="Planner"
        title="Planificación empresarial con IA"
        subtitle="Escribís lo que tenés en la cabeza. La IA lo clasifica, lo prioriza y lo distribuye en tu agenda respetando cuándo rendís mejor."
        features={[
          'Brain dump: sacá todo de la cabeza antes de priorizar',
          'Bloques protegidos para trabajo de foco profundo',
          'Reprogramación automática cuando algo se atrasa',
          'Sincronización con Google Calendar',
        ]}
        demo={
          <div className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-4 shadow-[var(--ferova-shadow)]">
            <div className="space-y-2">
              {BLOCKS.map((b) => (
                <div key={b.t} className="flex items-center gap-3 rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-canvas)] p-3">
                  <span className="w-14 font-mono text-xs text-[#8a8377]">{b.t}</span>
                  <span className="flex-1 text-sm font-medium text-[#1f1b16]">{b.label}</span>
                  <span className="rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-soft)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#57524a]">{b.tag}</span>
                </div>
              ))}
              <div className="mt-2 rounded-[var(--ferova-radius-control)] p-3 text-xs" style={{ backgroundColor: 'var(--ferova-ai)' }}>
                <span className="font-semibold text-[var(--ferova-gold)]">IA:</span>{' '}
                <span className="text-[#1f1b16]">Detecté 2 tareas pendientes de ayer. ¿Las corro a mañana temprano?</span>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-[#a39a8a]">Datos de demostración</p>
          </div>
        }
      >
        <section className="border-t border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-[#1f1b16]">Planificar por fecha límite no es lo mismo que planificar por energía</h2>
              <p className="mt-3 text-[#57524a]">
                Un calendario lleno de bloques no garantiza que el trabajo importante se haga bien. Ferova One organiza tu semana según tu energía
                real, protegiendo el tiempo de foco profundo del resto de tus tareas.
              </p>
              <p className="mt-3 text-sm text-[#8a8377]">
                Lee más en{' '}
                <Link to="/blog/organizar-semana-energia" className="font-medium text-[var(--ferova-brand)] underline">
                  cómo organizar una semana según energía y prioridad
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

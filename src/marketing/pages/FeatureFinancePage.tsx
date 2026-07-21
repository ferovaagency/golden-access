import { Link } from 'react-router-dom';
import { SeoHead } from '../../seo/SeoHead';
import { breadcrumbSchema, softwareApplicationSchema } from '../../seo/StructuredData';
import { FeaturePageLayout } from '../components/FeaturePageLayout';
import { Reveal } from '../components/Reveal';

const ROWS = [
  { c: 'Ingresos octubre', v: '$ 18.420.000', d: '+12%', up: true },
  { c: 'Egresos operativos', v: '$ 6.870.000', d: '−4%', up: true },
  { c: 'IVA a pagar', v: '$ 1.240.000', d: 'Vence 20', up: false },
  { c: 'Flujo proyectado 30d', v: '$ 9.310.000', d: 'Sano', up: true },
];

export default function FeatureFinancePage() {
  return (
    <>
      <SeoHead
        title="Software financiero para pequeñas empresas"
        description="Centraliza ingresos, egresos, flujo de caja e IVA colombiano en un solo lugar, con punto de equilibrio y alertas tributarias calculadas automáticamente."
        path="/funciones/finanzas"
        jsonLd={[
          softwareApplicationSchema(),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Producto', path: '/funciones' }, { name: 'Finanzas', path: '/funciones/finanzas' }]),
        ]}
      />
      <FeaturePageLayout
        eyebrow="Finanzas"
        title="Software financiero para pequeñas empresas"
        subtitle="Ingresos, egresos, costos y flujo de caja proyectado en un solo panel, con el IVA colombiano calculado sin hojas de cálculo aparte."
        features={[
          'Punto de equilibrio y margen por servicio calculados automáticamente',
          'Flujo de caja proyectado, no solo histórico',
          'Alertas tributarias antes de que venzan los plazos',
          'Respaldo e importación desde Google Sheets cuando lo necesites',
        ]}
        demo={
          <div className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-4 shadow-[var(--ferova-shadow)]">
            <div className="space-y-2">
              {ROWS.map((r) => (
                <div key={r.c} className="flex items-center justify-between rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-canvas)] p-3">
                  <div>
                    <div className="text-xs text-[#8a8377]">{r.c}</div>
                    <div className="font-display text-lg text-[#1f1b16]">{r.v}</div>
                  </div>
                  <span
                    className="rounded-[var(--ferova-radius-pill)] px-2 py-0.5 text-xs"
                    style={{ backgroundColor: r.up ? 'var(--ferova-positive)' : 'var(--ferova-warning)', color: r.up ? '#166534' : '#92400e' }}
                  >
                    {r.d}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-[#a39a8a]">Datos de demostración</p>
          </div>
        }
      >
        <section className="border-t border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold text-[#1f1b16]">Por qué separar finanzas en varias herramientas te cuesta margen</h2>
              <p className="mt-3 text-[#57524a]">
                Cuando ingresos, egresos y horas viven en archivos distintos, calcular tu rentabilidad real requiere cruzar datos manualmente cada vez.
                Ferova One calcula punto de equilibrio, margen por servicio y flujo de caja proyectado en tiempo real, a partir de los mismos datos que ya registrás.
              </p>
              <p className="mt-3 text-sm text-[#8a8377]">
                Lee más sobre el tema en{' '}
                <Link to="/blog/punto-de-equilibrio" className="font-medium text-[var(--ferova-brand)] underline">
                  punto de equilibrio: fórmula, ejemplo y calculadora
                </Link>{' '}
                o en{' '}
                <Link to="/blog/flujo-de-caja-servicios" className="font-medium text-[var(--ferova-brand)] underline">
                  flujo de caja para empresas de servicios
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

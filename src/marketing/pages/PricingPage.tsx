import { useEffect } from 'react';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { Reveal } from '../components/Reveal';
import { PlanPricingTable } from '../components/PlanPricingTable';
import { SeoHead } from '../../seo/SeoHead';
import { breadcrumbSchema, softwareApplicationSchema } from '../../seo/StructuredData';
import { trackEvent } from '../../lib/analytics';
import { PLAN_PRICES_USD } from '../../lib/planService';

// Freemium + 3 niveles (modelo del 8 oct 2026). Los precios viven en
// planService (PLAN_PRICES_USD) y deben coincidir con los prices de Paddle.

const FAQ = [
  { q: '¿El plan Gratis vence?', a: 'No. Es gratis para siempre y no pide tarjeta. Tiene topes de volumen: 15 tareas por semana, 20 movimientos al mes, 1 proyecto activo y 10 consultas al asistente al mes. Cuando los tocas, la app te muestra el plan que los quita.' },
  { q: '¿Cómo subo de plan?', a: 'Desde dentro de la app: al tocar un límite o un módulo bloqueado aparece el detalle de planes y pagas con tarjeta a través de Paddle. El cambio es inmediato.' },
  { q: '¿Qué pasa con mis datos si bajo de plan o cancelo?', a: 'Se quedan. Vuelves a los topes del plan Gratis, pero nada se borra. Tus datos siguen siendo tuyos.' },
  { q: '¿Hay permanencia mínima?', a: 'No. Mensual o anual, cancelas cuando quieras, sin penalidades. En el anual, el acceso se mantiene hasta el fin del periodo pagado.' },
  { q: '¿El precio incluye impuestos?', a: 'El precio mostrado es antes de impuestos según tu ubicación; Paddle, como comerciante registrado (Merchant of Record), calcula el total exacto en el checkout.' },
];

export default function PricingPage() {
  useEffect(() => { trackEvent('pricing_view', { path: '/precios' }); }, []);
  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      <SeoHead
        title="Precios: gratis para empezar, planes desde USD 19"
        description="Ferova One es gratis para siempre con lo esencial. Básico, Intermedio y Full cuando tu negocio crezca: desde USD 19 al mes, sin permanencia."
        path="/precios"
        jsonLd={[
          softwareApplicationSchema({ price: String(PLAN_PRICES_USD.basico), priceCurrency: 'USD' }),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Precios', path: '/precios' }]),
        ]}
      />
      <MarketingHeader />

      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <Reveal>
          <h1 className="font-display text-3xl font-bold text-[#1f1b16] sm:text-4xl">Gratis para empezar. Pagas cuando tu negocio lo pida.</h1>
          <p className="mx-auto mt-3 max-w-2xl text-[#57524a]">Sin tarjeta para arrancar, sin permanencia después. Cada plan quita un límite que tu propio crecimiento va a tocar.</p>
        </Reveal>
        <Reveal className="mt-10">
          <PlanPricingTable ctaPath="/app" source="/precios" />
        </Reveal>

        <Reveal className="mx-auto mt-16 max-w-2xl text-left">
          <h2 className="text-center font-display text-2xl font-semibold text-[#1f1b16]">Preguntas frecuentes sobre el precio</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-4">
                <summary className="cursor-pointer list-none font-medium text-[#1f1b16]">
                  <span className="flex items-center justify-between">
                    {item.q}
                    <span className="ml-4 text-[#a39a8a] transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-sm text-[#57524a]">{item.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>

      <MarketingFooter />
    </div>
  );
}

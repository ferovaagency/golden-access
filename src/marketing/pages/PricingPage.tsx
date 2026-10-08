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
  { q: '¿Cómo funciona la prueba gratis?', a: 'Eliges un plan y lo usas completo 7 días sin poner tarjeta. Si quieres seguir, agregas un método de pago desde la app; si no, el acceso se apaga solo al terminar y no se cobra nada.' },
  { q: '¿Qué pasa cuando tengo más clientes de los que permite mi plan?', a: 'La app te lo dice en el momento de activar el cliente que sobra y te muestra el plan que alcanza (4 clientes → Intermedio; 11 → Full). Los clientes que ya tienes no se tocan.' },
  { q: '¿Puedo cambiar de plan después?', a: 'Sí, desde dentro de la app. El cambio se prorratea desde el día en que lo haces. Durante la prueba, cambiar de plan puede pedir primero una tarjeta.' },
  { q: '¿Qué pasa con mis datos si dejo vencer la prueba o cancelo?', a: 'Se quedan guardados. Cuando agregues un método de pago, sigues exactamente donde ibas. Tus datos siguen siendo tuyos.' },
  { q: '¿Hay permanencia mínima?', a: 'No. Mensual o anual, cancelas cuando quieras, sin penalidades. En el anual, el acceso se mantiene hasta el fin del periodo pagado.' },
  { q: '¿El precio incluye impuestos?', a: 'El precio mostrado es antes de impuestos según tu ubicación; Paddle, como comerciante registrado (Merchant of Record), calcula el total exacto en el checkout.' },
];

export default function PricingPage() {
  useEffect(() => { trackEvent('pricing_view', { path: '/precios' }); }, []);
  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      <SeoHead
        title="Precios: 7 días gratis sin tarjeta, planes desde USD 19"
        description="Básico, Intermedio y Full desde USD 19 al mes, con 7 días de prueba sin tarjeta y 30 % de ahorro en el plan anual. Sin permanencia."
        path="/precios"
        jsonLd={[
          softwareApplicationSchema({ price: String(PLAN_PRICES_USD.basico.mensual), priceCurrency: 'USD' }),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Precios', path: '/precios' }]),
        ]}
      />
      <MarketingHeader />

      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <Reveal>
          <h1 className="font-display text-3xl font-bold text-[#1f1b16] sm:text-4xl">7 días gratis en el plan que elijas. Sin tarjeta.</h1>
          <p className="mx-auto mt-3 max-w-2xl text-[#57524a]">Planes para freelancers que crecen con tus clientes: hasta 3, hasta 10 o ilimitados. Pruebas el plan completo una semana sin tarjeta. Anual con 30 % de ahorro, sin permanencia.</p>
        </Reveal>
        <Reveal className="mt-10">
          <PlanPricingTable source="/precios" />
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

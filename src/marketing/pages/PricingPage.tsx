import { useEffect } from 'react';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { Reveal } from '../components/Reveal';
import { PlanPricingTable } from '../components/PlanPricingTable';
import { SeoHead } from '../../seo/SeoHead';
import { breadcrumbSchema, softwareApplicationSchema } from '../../seo/StructuredData';
import { trackEvent } from '../../lib/analytics';
import { PLAN_PRICES_USD } from '../../lib/planService';

// Gratis / Medio / Pro (nov 2026). Los precios viven en planService
// (PLAN_PRICES_USD) y deben coincidir con los planes creados en Whop.

const FAQ = [
  { q: '¿El plan Gratis tiene fecha de vencimiento?', a: 'No. Lo usas el tiempo que quieras, sin tarjeta, con hasta 2 clientes activos. Cuando necesitas más, subes de plan desde la app y no pierdes nada de lo que ya cargaste.' },
  { q: '¿Qué pasa cuando tengo más clientes de los que permite mi plan?', a: 'La app te lo dice en el momento de activar el cliente que sobra y te muestra el plan que alcanza (3 clientes → Medio; 11 → Pro). Los clientes que ya tienes no se tocan.' },
  { q: '¿Puedo cambiar de plan después?', a: 'Sí, desde dentro de la app. Al pagar el plan nuevo, el anterior se cancela automáticamente.' },
  { q: '¿Qué pasa con mis datos si cancelo?', a: 'Se quedan guardados. Tu cuenta vuelve al plan Gratis y, si vuelves a un plan de pago, sigues exactamente donde ibas. Tus datos siguen siendo tuyos.' },
  { q: '¿Hay permanencia mínima?', a: 'No. Mensual o anual, cancelas cuando quieras, sin penalidades. El acceso se mantiene hasta el fin del periodo pagado.' },
  { q: '¿El precio incluye impuestos?', a: 'El precio mostrado es antes de impuestos. El pago se procesa con Whop, que muestra el total exacto según tu país antes de pagar.' },
];

export default function PricingPage() {
  useEffect(() => { trackEvent('pricing_view', { path: '/precios' }); }, []);
  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      <SeoHead
        title="Precios: plan Gratis para siempre, planes de pago desde USD 20"
        description="Empieza gratis sin tarjeta. Medio a USD 20 y Pro a USD 50 al mes, con 30 % de ahorro en el plan anual. Sin permanencia."
        path="/precios"
        jsonLd={[
          softwareApplicationSchema({ price: String(PLAN_PRICES_USD.medio.mensual), priceCurrency: 'USD' }),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Precios', path: '/precios' }]),
        ]}
      />
      <MarketingHeader />

      <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <Reveal>
          <h1 className="font-display text-3xl font-bold text-[#1f1b16] sm:text-4xl">Empieza gratis. Paga cuando tu negocio lo pida.</h1>
          <p className="mx-auto mt-3 max-w-2xl text-[#57524a]">Planes que crecen con tus clientes: hasta 2 gratis, hasta 10 en Medio o ilimitados en Pro. Sin tarjeta para empezar. Anual con 30 % de ahorro, sin permanencia.</p>
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

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { Reveal } from '../components/Reveal';
import { SeoHead } from '../../seo/SeoHead';
import { breadcrumbSchema, softwareApplicationSchema } from '../../seo/StructuredData';
import { AnimatedCard } from '../../components/motion/AnimatedCard';
import { trackEvent } from '../../lib/analytics';

// El precio ya se usa consistentemente en el resto del producto (Landing,
// LandingV2, paywall). Manual_Landing_Blog_SEO sec. 2/14: de todos modos
// reconfirmar precio, moneda y mercado antes de invertir en promocionar
// especificamente esta pagina.
const PRICE_USD = '50';

const FEATURES = [
  'Todos los módulos incluidos',
  'Asistente IA sin límite razonable',
  'Google Calendar, Sheets y WhatsApp',
  'CRM + enriquecimiento Apollo',
  'Soporte por correo',
];

const FAQ = [
  { q: '¿Hay permanencia mínima?', a: 'No. Podés cancelar cuando quieras, sin penalidades.' },
  { q: '¿El precio incluye impuestos?', a: 'El precio mostrado es antes de impuestos aplicables según tu ubicación; PayPal calcula el total exacto en el checkout.' },
  { q: '¿Puedo probarlo antes de pagar?', a: 'Podés crear una cuenta y explorar el demo del Executive Control Center antes de decidir.' },
  { q: '¿Qué pasa si cancelo?', a: 'Tu acceso se mantiene hasta el fin del período ya pagado. Tus datos siguen siendo tuyos.' },
];

export default function PricingPage() {
  useEffect(() => { trackEvent('pricing_view', { path: '/precios' }); }, []);
  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      <SeoHead
        title="Precios"
        description="Un solo plan con todos los módulos incluidos: finanzas, CRM, planner, proyectos y asistente IA. Sin permanencia, cancelás cuando quieras."
        path="/precios"
        jsonLd={[
          softwareApplicationSchema({ price: PRICE_USD, priceCurrency: 'USD' }),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Precios', path: '/precios' }]),
        ]}
      />
      <MarketingHeader />

      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <Reveal>
          <h1 className="font-display text-3xl font-bold text-[#1f1b16] sm:text-4xl">Un solo plan. Todo incluido.</h1>
          <p className="mt-3 text-[#57524a]">Sin trucos, sin escalar por usuarios, sin sorpresas.</p>
        </Reveal>
        <Reveal>
          <AnimatedCard hoverable={false} className="mx-auto mt-10 max-w-md rounded-[var(--ferova-radius-hero)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-8 text-left shadow-[var(--ferova-shadow)]">
            <span className="inline-flex items-center rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-gold)]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ferova-gold)]">
              Precio de lanzamiento · Founder Access
            </span>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-5xl text-[#1f1b16]">USD {PRICE_USD}</span>
              <span className="text-[#8a8377]">/ mes</span>
            </div>
            <p className="mt-1 text-sm text-[#8a8377]">Facturado mensualmente. Cancelás cuando quieras.</p>
            <ul className="mt-6 space-y-2">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[#1f1b16]">
                  <Check className="mt-0.5 h-4 w-4 text-[var(--ferova-brand)]" /> {f}
                </li>
              ))}
            </ul>
            <Link to="/app" onClick={() => trackEvent('pricing_cta', { path: '/precios' })} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-6 py-3 font-medium font-display text-white hover:bg-[var(--ferova-brand-2)]">
              Empezar ahora <ArrowRight className="h-4 w-4" />
            </Link>
          </AnimatedCard>
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

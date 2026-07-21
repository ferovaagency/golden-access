import { Link } from 'react-router-dom';
import { Brain, LineChart, Users, FolderKanban, TrendingUp, Bot, ArrowRight } from 'lucide-react';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { Reveal } from '../components/Reveal';
import { SeoHead } from '../../seo/SeoHead';
import { breadcrumbSchema, collectionPageSchema } from '../../seo/StructuredData';
import { AnimatedCard } from '../../components/motion/AnimatedCard';

const MODULES = [
  { icon: LineChart, title: 'Finanzas', desc: 'Ingresos, egresos, flujo de caja e impuestos en tiempo real.', path: '/funciones/finanzas' },
  { icon: Users, title: 'CRM', desc: 'Pipeline, seguimiento y propuestas sin perder oportunidades.', path: '/funciones/crm' },
  { icon: Brain, title: 'Planner', desc: 'Planificación por energía, brain dump y bloques protegidos.', path: '/funciones/planner' },
  { icon: Bot, title: 'Asistente IA', desc: 'Un copiloto que ya conoce el contexto real de tu negocio.', path: '/funciones/asistente-ia' },
  { icon: FolderKanban, title: 'Proyectos', desc: 'Capacidad, avance y rentabilidad por proyecto conectados.', path: '/funciones' },
  { icon: TrendingUp, title: 'Marketing ROI', desc: 'ROI, ROAS y CAC de tus campañas en un solo panel.', path: '/funciones' },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      <SeoHead
        title="Producto"
        description="Finanzas, CRM, Planner, Proyectos, Marketing ROI e IA contextual conectados en un solo sistema operativo empresarial."
        path="/funciones"
        jsonLd={[
          collectionPageSchema({ name: 'Producto Ferova One', description: 'Módulos de Ferova One.', path: '/funciones' }),
          breadcrumbSchema([{ name: 'Inicio', path: '/' }, { name: 'Producto', path: '/funciones' }]),
        ]}
      />
      <MarketingHeader />

      <section className="border-b border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ferova-brand)]">Producto</span>
          <h1 className="mt-2 font-display text-3xl font-bold text-[#1f1b16] sm:text-4xl">Un sistema, no seis herramientas sueltas</h1>
          <p className="mt-3 text-[#57524a]">Cada módulo de Ferova One comparte los mismos datos, así que nunca tenés que exportar, copiar o cruzar reportes a mano.</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module) => (
            <Reveal key={module.title}>
              <Link to={module.path}>
                <AnimatedCard className="h-full rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-6">
                  <div className="grid h-10 w-10 place-items-center rounded-[var(--ferova-radius-control)] bg-[var(--ferova-soft)] text-[var(--ferova-brand)]">
                    <module.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 font-display font-semibold text-[#1f1b16]">{module.title}</h2>
                  <p className="mt-1 text-sm text-[#57524a]">{module.desc}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ferova-brand)]">
                    Ver detalle <ArrowRight className="h-3 w-3" />
                  </span>
                </AnimatedCard>
              </Link>
            </Reveal>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Link to="/precios" className="inline-flex items-center gap-2 rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-6 py-3 font-medium font-display text-white hover:bg-[var(--ferova-brand-2)]">
            Ver precios <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}

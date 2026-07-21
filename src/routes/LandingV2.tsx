import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Sparkles, Brain, LineChart, Users, CalendarClock, MessageSquare,
  Zap, ShieldCheck, ArrowRight, Check, Bot, Target, TrendingUp,
  Plug, LayoutGrid, ScanSearch, Wand2, PlayCircle, AlertTriangle,
} from 'lucide-react';
import { AnimatedCard } from '../components/motion/AnimatedCard';
import { SeoHead } from '../seo/SeoHead';
import { organizationSchema, softwareApplicationSchema } from '../seo/StructuredData';

/**
 * Landing v2 -- ruta nueva y aditiva (/landing-v2), no reemplaza /landing.
 * Manual_Implementacion_Diseno_Ferova_One, seccion 8 + Fase 6. Nocturnal
 * Geometry adaptado a fondo claro: sin secciones completas oscuras, acento
 * borgona en CTAs, navy para analitica, gold para IA. Sin llamadas a
 * backend -- toda la data de las demos es fixture, marcada como tal.
 */
export default function LandingV2() {
  return (
    <div className="min-h-screen bg-[var(--ferova-canvas)] text-[#1f1b16] font-sans">
      {/* noindex a proposito: preview pendiente de aprobacion, todavia no promovida a /.
          Sacar noindex={true} cuando se decida activarla (ver docs/SEO_LANDING_BLOG.md). */}
      <SeoHead
        title="Ferova One (preview de diseño)"
        description="Vista previa del rediseño de la landing de Ferova One."
        path="/landing-v2"
        noindex
        jsonLd={[organizationSchema(), softwareApplicationSchema()]}
      />
      <Header />
      <Hero />
      <TrustBar />
      <Problem />
      <ExecutiveDemo />
      <ModulesGrid />
      <PlannerDemo />
      <FinanceDemo />
      <CrmDemo />
      <AiDemo />
      <HowItWorks />
      <UseCases />
      <Pricing />
      <Faq />
      <Footer />
    </div>
  );
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--ferova-line)] bg-[var(--ferova-canvas)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/landing-v2" className="flex items-center gap-2 font-display font-semibold tracking-tight">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--ferova-brand)] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span>Ferova One</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-[#57524a] md:flex">
          <a href="#modulos" className="hover:text-[#1f1b16]">Módulos</a>
          <a href="#planner" className="hover:text-[#1f1b16]">Planner</a>
          <a href="#precios" className="hover:text-[#1f1b16]">Precios</a>
          <a href="#faq" className="hover:text-[#1f1b16]">FAQ</a>
        </nav>
        <Link
          to="/app"
          className="rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-4 py-2 text-sm font-medium font-display text-white hover:bg-[var(--ferova-brand-2)]"
        >
          Iniciar sesión
        </Link>
      </div>
    </header>
  );
}

function TiltPreviewCard() {
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rotateX = ((e.clientY - rect.top) / rect.height - 0.5) * -4;
    const rotateY = ((e.clientX - rect.left) / rect.width - 0.5) * 4;
    e.currentTarget.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };
  const onLeave = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.transform = ''; };
  const cards = [
    { label: 'Finanzas', value: '$ 18.4M', tone: 'text-[var(--ferova-navy)]', icon: LineChart },
    { label: 'CRM', value: '12 activas', tone: 'text-[var(--ferova-brand)]', icon: Users },
    { label: 'Planner', value: '4 bloques hoy', tone: 'text-[#57524a]', icon: Brain },
    { label: 'IA', value: 'siempre activa', tone: 'text-[var(--ferova-gold)]', icon: Bot },
  ];
  return (
    <div
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative mx-auto grid max-w-sm grid-cols-2 gap-3 transition-transform duration-150 ease-out"
      style={{ transformStyle: 'preserve-3d' }}
    >
      {cards.map(({ label, value, tone, icon: Icon }) => (
        <div key={label} className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-4 shadow-[var(--ferova-shadow)]">
          <Icon className={`h-4 w-4 ${tone}`} />
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a39a8a]">{label}</p>
          <p className="mt-1 font-display text-sm font-semibold text-[#1f1b16]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--ferova-line)]">
      <div
        className="absolute inset-0 opacity-70"
        style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(84,16,20,0.06), transparent 40%), radial-gradient(circle at 85% 60%, rgba(192,147,14,0.10), transparent 45%)' }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2 md:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-[var(--ferova-radius-pill)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] px-3 py-1 text-xs font-medium text-[var(--ferova-brand)]">
            <Sparkles className="h-3.5 w-3.5" /> Sistema operativo de negocio con IA
          </span>
          <h1 className="mt-6 font-display text-4xl leading-tight tracking-tight text-[#1f1b16] md:text-6xl">
            Tu empresa, <span className="text-[var(--ferova-brand)]">en una mirada.</span>
          </h1>
          <p className="mt-6 text-lg text-[#57524a] md:text-xl">
            Ferova One convierte datos dispersos en decisiones. Finanzas, CRM, Planner y un asistente con IA que ya sabe qué está pasando en tu negocio.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link to="/app" className="inline-flex items-center gap-2 rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-6 py-3 font-medium font-display text-white hover:bg-[var(--ferova-brand-2)]">
              Empezar ahora <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#modulos" className="inline-flex items-center gap-2 rounded-[var(--ferova-radius-pill)] border border-[var(--ferova-line)] px-6 py-3 font-medium font-display text-[#57524a] hover:bg-[var(--ferova-soft)]">
              Ver demos
            </a>
          </div>
          <p className="mt-4 text-xs text-[#8a8377]">USD 50 / mes · Sin permanencia · Cancelás cuando quieras</p>
        </div>
        <TiltPreviewCard />
      </div>
    </section>
  );
}

function TrustBar() {
  const items = [
    { k: '6', v: 'módulos integrados' },
    { k: '1', v: 'asistente IA siempre activo' },
    { k: '100%', v: 'de tus datos, tuyos' },
    { k: '24/7', v: 'operación autónoma' },
  ];
  return (
    <section className="border-b border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
        {items.map((i) => (
          <div key={i.v} className="text-center">
            <div className="font-display text-3xl text-[#1f1b16]">{i.k}</div>
            <div className="mt-1 text-xs uppercase tracking-widest text-[#8a8377]">{i.v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Problem() {
  const fragments = [
    { label: 'Hoja de cálculo', icon: LineChart },
    { label: 'Chat de WhatsApp', icon: MessageSquare },
    { label: 'Notas sueltas', icon: ScanSearch },
    { label: 'Otro CRM', icon: Users },
  ];
  return (
    <section className="border-b border-[var(--ferova-line)] bg-[var(--ferova-canvas)]">
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <Reveal>
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ferova-brand)]">El problema</span>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">Tu negocio no vive en un solo lugar. Por eso se te escapa.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[#57524a]">
            Cada herramienta suelta es una decisión que no se toma a tiempo: una venta sin registrar, una hora sin cobrar, un prospecto que se enfría.
          </p>
        </Reveal>
        <motion.div
          className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-3"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
        >
          {fragments.map(({ label, icon: Icon }) => (
            <motion.div
              key={label}
              variants={{ hidden: { opacity: 0, scale: 0.85, y: 10 }, show: { opacity: 1, scale: 1, y: 0 } }}
              className="flex items-center gap-2 rounded-[var(--ferova-radius-pill)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] px-4 py-2 text-sm text-[#57524a] shadow-[var(--ferova-shadow)]"
            >
              <Icon className="h-4 w-4 text-[#a39a8a]" /> {label}
            </motion.div>
          ))}
          <ArrowRight className="h-5 w-5 shrink-0 text-[var(--ferova-brand)]" />
          <motion.div
            variants={{ hidden: { opacity: 0, scale: 0.85 }, show: { opacity: 1, scale: 1 } }}
            className="flex items-center gap-2 rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-4 py-2 text-sm font-semibold font-display text-white shadow-[var(--ferova-shadow-hover)]"
          >
            <Sparkles className="h-4 w-4" /> Ferova One
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function ExecutiveDemo() {
  const [period, setPeriod] = useState('Octubre 2026');
  const kpis = [
    { label: 'Ingresos', value: '$ 18.420.000' },
    { label: 'Utilidad operativa', value: '$ 9.310.000' },
    { label: 'Clientes activos', value: '12' },
    { label: 'Horas registradas', value: '86 h' },
  ];
  return (
    <section className="border-b border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ferova-navy)]">Demo interactiva</span>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">Executive Control Center</h2>
          <p className="mt-3 text-[#57524a]">Así se ve tu negocio apenas entrás. Datos de demostración, tocá los controles.</p>
        </Reveal>
        <Reveal>
          <AnimatedCard hoverable={false} className="mx-auto mt-10 max-w-3xl rounded-[var(--ferova-radius-hero)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-6 shadow-[var(--ferova-shadow)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-lg font-semibold text-[#1f1b16]">Tu negocio, en una mirada.</p>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-canvas)] px-3 py-1.5 text-xs font-mono"
              >
                <option>Octubre 2026</option>
                <option>Septiembre 2026</option>
                <option>Histórico</option>
              </select>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {kpis.map((k) => (
                <div key={k.label} className="rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-canvas)] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a39a8a]">{k.label}</p>
                  <p className="mt-1 font-display text-base font-semibold text-[#1f1b16]">{k.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-[var(--ferova-radius-control)] p-3" style={{ backgroundColor: 'var(--ferova-warning)' }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#92400e' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: '#92400e' }}>Blind Spot: meta de equilibrio pendiente</p>
                <p className="mt-0.5 text-xs" style={{ color: '#92400e' }}>Faltan $ 2.100.000 para el punto de equilibrio de {period}.</p>
              </div>
            </div>
            <button className="mt-4 flex w-full items-center gap-2 rounded-[var(--ferova-radius-control)] p-3 text-left text-sm" style={{ backgroundColor: 'var(--ferova-ai)' }}>
              <Bot className="h-4 w-4 text-[var(--ferova-gold)]" />
              <span className="text-[#1f1b16]">Preguntarle a la IA cómo vamos este mes</span>
            </button>
            <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-[#a39a8a]">Datos de demostración</p>
          </AnimatedCard>
        </Reveal>
      </div>
    </section>
  );
}

function ModulesGrid() {
  const modules = [
    { icon: Brain, title: 'Smart Planner', desc: 'Agenda por energía. Brain dump, priorización y reprogramación automática.' },
    { icon: LineChart, title: 'Finanzas operativas', desc: 'Ingresos, egresos, impuestos y flujo de caja proyectado. IVA colombiano soportado.' },
    { icon: Users, title: 'CRM inteligente', desc: 'Prospectos, oportunidades, enriquecimiento con Apollo y outreach generado por IA.' },
    { icon: MessageSquare, title: 'WhatsApp con memoria', desc: 'Conecta tu número, responde con IA y registra cada conversación como oportunidad.' },
    { icon: CalendarClock, title: 'Calendar sync', desc: 'Sincroniza Google Calendar y tu link de reserva. Nada se te pasa.' },
    { icon: Bot, title: 'Asistente ejecutivo', desc: 'Panel lateral siempre presente que ve tus datos y te da la siguiente jugada.' },
  ];
  return (
    <section id="modulos" className="mx-auto max-w-6xl px-4 py-20">
      <Reveal className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl md:text-4xl">Un módulo para cada parte del negocio</h2>
        <p className="mt-3 text-[#57524a]">Todos conectados. Toda tu operación en una sola pantalla.</p>
      </Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <AnimatedCard key={m.title} className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-6">
            <div className="grid h-10 w-10 place-items-center rounded-[var(--ferova-radius-control)] bg-[var(--ferova-soft)] text-[var(--ferova-brand)]">
              <m.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display font-semibold text-[#1f1b16]">{m.title}</h3>
            <p className="mt-1 text-sm text-[#57524a]">{m.desc}</p>
          </AnimatedCard>
        ))}
      </div>
    </section>
  );
}

function DemoFrame({
  id, eyebrow, title, desc, children, reverse = false,
}: { id: string; eyebrow: string; title: string; desc: string; children: ReactNode; reverse?: boolean }) {
  return (
    <section id={id} className="border-t border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
      <div className={`mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2 ${reverse ? 'md:[&>div:first-child]:order-2' : ''}`}>
        <Reveal>
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ferova-brand)]">{eyebrow}</span>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">{title}</h2>
          <p className="mt-3 text-[#57524a]">{desc}</p>
        </Reveal>
        <Reveal>
          <div className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-4 shadow-[var(--ferova-shadow)]">{children}</div>
        </Reveal>
      </div>
    </section>
  );
}

function PlannerDemo() {
  const blocks = [
    { t: '09:00', label: 'Focus profundo — Cerrar propuesta Nova', tag: 'Energía alta' },
    { t: '11:00', label: 'Llamada Mariana (CRM warm)', tag: 'Reunión' },
    { t: '14:00', label: 'Admin ligera — Facturar octubre', tag: 'Energía baja' },
    { t: '16:30', label: 'Espacio protegido — Estrategia Q1', tag: 'Bloqueado' },
  ];
  return (
    <DemoFrame id="planner" eyebrow="Smart Planner" title="Tu día, planeado por tu energía" desc="Escribís lo que tenés en la cabeza. La IA lo clasifica, lo prioriza y lo distribuye en tu agenda respetando cuándo pensás mejor.">
      <div className="space-y-2">
        {blocks.map((b) => (
          <div key={b.t} className="flex items-center gap-3 rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-canvas)] p-3">
            <span className="w-14 font-mono text-xs text-[#8a8377]">{b.t}</span>
            <span className="flex-1 text-sm font-medium text-[#1f1b16]">{b.label}</span>
            <span className="rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-soft)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#57524a]">{b.tag}</span>
          </div>
        ))}
        <div className="mt-4 rounded-[var(--ferova-radius-control)] p-3 text-xs" style={{ backgroundColor: 'var(--ferova-ai)' }}>
          <span className="font-semibold text-[var(--ferova-gold)]">IA:</span> <span className="text-[#1f1b16]">Detecté 2 tareas pendientes de ayer. ¿Las corro a mañana temprano?</span>
        </div>
      </div>
    </DemoFrame>
  );
}

function FinanceDemo() {
  const rows = [
    { c: 'Ingresos octubre', v: '$ 18.420.000', d: '+12%', up: true },
    { c: 'Egresos operativos', v: '$ 6.870.000', d: '−4%', up: true },
    { c: 'IVA a pagar', v: '$ 1.240.000', d: 'Vence 20', up: false },
    { c: 'Flujo proyectado 30d', v: '$ 9.310.000', d: 'Sano', up: true },
  ];
  return (
    <DemoFrame id="finance" eyebrow="Finanzas operativas" title="Lo que ganás, lo que debés, lo que viene" desc="Importa desde Google Sheets, registra ventas y egresos, y ve tu salud financiera en tiempo real. Impuestos colombianos calculados automáticamente." reverse>
      <div className="space-y-2">
        {rows.map((r) => (
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
    </DemoFrame>
  );
}

function CrmDemo() {
  const leads = [
    { n: 'Nova Studio', s: 'Propuesta enviada', temp: 'Caliente' },
    { n: 'Marca Alfa', s: 'Esperando decisión', temp: 'Tibio' },
    { n: 'Ecomm Delta', s: 'Primer contacto', temp: 'Frío' },
  ];
  return (
    <DemoFrame id="crm" eyebrow="CRM" title="Prospectos enriquecidos, outreach hecho" desc="Pega un dominio o una lista de correos. Apollo trae la info, la IA escribe el primer mensaje y vos aprobás.">
      <div className="space-y-2">
        {leads.map((l) => (
          <div key={l.n} className="flex items-center justify-between rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-canvas)] p-3">
            <div>
              <div className="font-medium text-[#1f1b16]">{l.n}</div>
              <div className="text-xs text-[#8a8377]">{l.s}</div>
            </div>
            <span className="rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-soft)] px-2 py-0.5 text-xs text-[#57524a]">{l.temp}</span>
          </div>
        ))}
        <button type="button" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[var(--ferova-radius-control)] bg-[var(--ferova-brand)] px-3 py-2 text-sm font-display text-white">
          <Zap className="h-4 w-4" /> Generar outreach con IA
        </button>
      </div>
    </DemoFrame>
  );
}

function AiDemo() {
  return (
    <DemoFrame id="ai" eyebrow="Asistente ejecutivo" title="Una IA que ve tu negocio entero" desc="No es un chatbot genérico. El asistente lee tus finanzas, tu CRM y tu agenda, y te dice qué está fallando antes de que lo notes." reverse>
      <div className="space-y-3">
        <div className="rounded-[var(--ferova-radius-control)] bg-[var(--ferova-soft)] p-3 text-sm text-[#57524a]">
          <span className="font-medium text-[#1f1b16]">Vos:</span> ¿Cómo vamos este mes?
        </div>
        <div className="rounded-[var(--ferova-radius-control)] p-3 text-sm" style={{ backgroundColor: 'var(--ferova-ai)' }}>
          <span className="font-medium text-[var(--ferova-gold)]">IA:</span> <span className="text-[#1f1b16]">Ingresos +12% vs. septiembre, pero <b>3 oportunidades</b> del CRM llevan más de 7 días sin movimiento. La más grande vale $ 4.2M. ¿Te preparo el follow-up?</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#8a8377]">
          <Target className="h-3.5 w-3.5" /> Proactivo · <TrendingUp className="h-3.5 w-3.5" /> Contextual · <ShieldCheck className="h-3.5 w-3.5" /> Privado
        </div>
      </div>
    </DemoFrame>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Plug, title: 'Conecta', desc: 'Google, Sheets y WhatsApp en minutos.' },
    { icon: LayoutGrid, title: 'Organiza', desc: 'Tus datos entran a un solo sistema.' },
    { icon: ScanSearch, title: 'Detecta', desc: 'La IA encuentra lo que se te está pasando.' },
    { icon: Wand2, title: 'Recomienda', desc: 'Te dice la siguiente jugada, no solo el número.' },
    { icon: PlayCircle, title: 'Ejecuta', desc: 'Vos aprobás. Nada se mueve solo.' },
  ];
  return (
    <section className="border-t border-[var(--ferova-line)] bg-[var(--ferova-canvas)]">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ferova-navy)]">Cómo funciona</span>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">De datos dispersos a la siguiente jugada</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-5">
          {steps.map((s, index) => (
            <Reveal key={s.title} className="relative">
              <div className="rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-5 text-center shadow-[var(--ferova-shadow)]">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--ferova-brand)] font-display text-sm font-bold text-white">{index + 1}</div>
                <s.icon className="mx-auto mt-3 h-5 w-5 text-[var(--ferova-navy)]" />
                <h3 className="mt-2 font-display text-sm font-semibold text-[#1f1b16]">{s.title}</h3>
                <p className="mt-1 text-xs text-[#8a8377]">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [
    { id: 'freelancer', label: 'Freelancer', title: 'Cobrá lo que vale tu tiempo', desc: 'Registra horas por cliente y servicio, y ve tu margen real antes de aceptar el próximo proyecto.' },
    { id: 'consultor', label: 'Consultor', title: 'Un pipeline que no se te enfría', desc: 'CRM propio para diagnósticos, propuestas y seguimiento, con IA que te avisa qué oportunidad lleva días sin moverse.' },
    { id: 'agencia', label: 'Agencia', title: 'Finanzas y equipo en una sola vista', desc: 'Ingresos, costos y capacidad del equipo conectados, sin exportar hojas de cálculo cada fin de mes.' },
    { id: 'small-business', label: 'Small business', title: 'IVA y flujo de caja bajo control', desc: 'Alertas tributarias y punto de equilibrio calculados automáticamente para el mercado colombiano.' },
  ];
  const [active, setActive] = useState(cases[0].id);
  const current = cases.find((c) => c.id === active)!;
  return (
    <section className="border-t border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
      <div className="mx-auto max-w-4xl px-4 py-20">
        <Reveal className="text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ferova-brand)]">Casos de uso</span>
          <h2 className="mt-2 font-display text-3xl md:text-4xl">Hecho para operar solo o en equipo chico</h2>
        </Reveal>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {cases.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`rounded-[var(--ferova-radius-pill)] px-4 py-2 text-sm font-medium font-display transition ${
                active === c.id ? 'bg-[var(--ferova-brand)] text-white' : 'bg-[var(--ferova-surface)] text-[#57524a] border border-[var(--ferova-line)]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mx-auto mt-8 max-w-2xl rounded-[var(--ferova-radius-card)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-6 text-center shadow-[var(--ferova-shadow)] sm:p-8"
        >
          <h3 className="font-display text-xl font-semibold text-[#1f1b16]">{current.title}</h3>
          <p className="mt-2 text-sm text-[#57524a]">{current.desc}</p>
        </motion.div>
      </div>
    </section>
  );
}

function Pricing() {
  const features = [
    'Todos los módulos incluidos',
    'Asistente IA sin límite razonable',
    'Google Calendar, Sheets y WhatsApp',
    'CRM + enriquecimiento Apollo',
    'Soporte por correo',
  ];
  return (
    <section id="precios" className="border-t border-[var(--ferova-line)] bg-[var(--ferova-canvas)]">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Reveal>
          <h2 className="font-display text-3xl md:text-4xl">Un solo plan. Todo incluido.</h2>
          <p className="mt-3 text-[#57524a]">Sin trucos, sin escalar por usuarios, sin sorpresas.</p>
        </Reveal>
        <Reveal>
          <div className="mx-auto mt-10 max-w-md rounded-[var(--ferova-radius-hero)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-8 text-left shadow-[var(--ferova-shadow)]">
            <span className="inline-flex items-center rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-gold)]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--ferova-gold)]">Precio de lanzamiento · Founder Access</span>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-5xl text-[#1f1b16]">USD 50</span>
              <span className="text-[#8a8377]">/ mes</span>
            </div>
            <p className="mt-1 text-sm text-[#8a8377]">Facturado mensualmente. Cancelás cuando quieras.</p>
            <ul className="mt-6 space-y-2">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[#1f1b16]">
                  <Check className="mt-0.5 h-4 w-4 text-[var(--ferova-brand)]" /> {f}
                </li>
              ))}
            </ul>
            <Link to="/app" className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-[var(--ferova-radius-pill)] bg-[var(--ferova-brand)] px-6 py-3 font-medium font-display text-white hover:bg-[var(--ferova-brand-2)]">
              Empezar ahora <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Faq() {
  const qa = [
    { q: '¿Necesito instalar algo?', a: 'No. Ferova One es 100% web. Iniciás sesión con Google y ya está.' },
    { q: '¿Mis datos están seguros?', a: 'Sí. Cada cuenta está aislada por permisos a nivel de base de datos. Solo vos ves tus datos.' },
    { q: '¿Cómo se procesan los pagos?', a: 'A través de PayPal. Ferova One no recibe ni almacena datos de pago.' },
    { q: '¿Funciona fuera de Colombia?', a: 'Sí. La calculadora de impuestos está preparada para Colombia; el resto de módulos funciona en cualquier país.' },
    { q: '¿Cómo funciona la IA con mis datos?', a: 'Solo usa el contexto necesario de tu negocio para responder. No entrenamos modelos con tu información.' },
    { q: '¿Puedo cancelar?', a: 'Cuando quieras. Sin permanencia, sin penalidades.' },
  ];
  return (
    <section id="faq" className="border-t border-[var(--ferova-line)] bg-[var(--ferova-soft)]">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <Reveal>
          <h2 className="text-center font-display text-3xl md:text-4xl">Preguntas frecuentes</h2>
        </Reveal>
        <div className="mt-10 space-y-3">
          {qa.map((i) => (
            <details key={i.q} className="group rounded-[var(--ferova-radius-control)] border border-[var(--ferova-line)] bg-[var(--ferova-surface)] p-4">
              <summary className="cursor-pointer list-none font-medium text-[#1f1b16]">
                <span className="flex items-center justify-between">
                  {i.q}
                  <span className="ml-4 text-[#a39a8a] transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-2 text-sm text-[#57524a]">{i.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[var(--ferova-line)] bg-[var(--ferova-canvas)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-[#8a8377] md:flex-row">
        <div>© {new Date().getFullYear()} Ferova One. Todos los derechos reservados.</div>
        <div className="flex gap-4">
          <Link to="/terminos" className="hover:text-[#1f1b16]">Términos</Link>
          <Link to="/privacidad" className="hover:text-[#1f1b16]">Privacidad</Link>
        </div>
      </div>
    </footer>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  Sparkles, Brain, LineChart, Users, CalendarClock, MessageSquare,
  Zap, ShieldCheck, ArrowRight, Check, Bot, Target, TrendingUp,
} from 'lucide-react';
import { SeoHead } from '../seo/SeoHead';
import { organizationSchema, websiteSchema, softwareApplicationSchema } from '../seo/StructuredData';
import { trackEvent } from '../lib/analytics';
import { useInViewOnce } from '../lib/useInViewOnce';
import { HeroOrbit } from '../marketing/components/HeroOrbit';
import { Reveal } from '../marketing/components/Reveal';
import { consumePostLoginReturn, supabase } from '../lib/supabase';

/**
 * Public sales landing at /landing.
 * Nocturnal-adjacent but tuned to the app's current light theme:
 * dark hero with gold accents, then light module demos below.
 * Única llamada a backend: founder_slots_taken() (un entero, RPC pública)
 * para el contador real de cupos Founder; todo lo demás es presentación.
 */
export default function Landing() {
  useEffect(() => {
    // If a provider ignored the requested OAuth redirect URI and returned to
    // the public root, do not strand the newly authenticated user on the
    // marketing page. We only redirect after Supabase confirms the session.
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session?.user) return;
      const returnTo = consumePostLoginReturn();
      if (returnTo === '/app') window.location.replace(returnTo);
    });
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <SeoHead
        title="Software para gestionar finanzas, ventas y proyectos"
        description="Centraliza finanzas, CRM, proyectos y planificación con un asistente de IA que trabaja con los datos de tu negocio."
        path="/"
        jsonLd={[organizationSchema(), websiteSchema(), softwareApplicationSchema()]}
      />
      <Header />
      <Hero />
      <SocialProof />
      <LiveWorkflow />
      <ModulesGrid />
      <PlannerDemo />
      <FinanceDemo />
      <CrmDemo />
      <AiDemo />
      <Pricing />
      <Faq />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/landing" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-amber-300">
            <Sparkles className="h-4 w-4" />
          </div>
          <span>Ferova One</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          <a href="#modulos" className="hover:text-slate-900">Módulos</a>
          <a href="#planner" className="hover:text-slate-900">Planner</a>
          <Link to="/blog" className="hover:text-slate-900">Blog</Link>
          <a href="#precios" className="hover:text-slate-900">Precios</a>
          <a href="#faq" className="hover:text-slate-900">FAQ</a>
        </nav>
        <Link to="/blog" className="rounded-full px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 md:hidden">
          Blog
        </Link>
        <Link
          to="/app"
          onClick={() => trackEvent('login_click', { path: 'header-/' })}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Iniciar sesión
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  const reduceMotion = useReducedMotion();
  const remaining = useFounderSlots();
  return (
    <section className="relative isolate overflow-hidden bg-[#09122b] text-white">
      <motion.div
        className="absolute -left-28 top-0 h-[30rem] w-[30rem] rounded-full bg-[#981737]/40 blur-3xl"
        animate={reduceMotion ? undefined : { x: [0, 80, 0], y: [0, 38, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full bg-[#52407f]/35 blur-3xl"
        animate={reduceMotion ? undefined : { x: [0, -65, 0], y: [0, -32, 0], scale: [1.08, 1, 1.08] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(251,191,36,0.15), transparent 40%), radial-gradient(circle at 80% 60%, rgba(59,130,246,0.18), transparent 45%)',
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-20 md:grid-cols-[1.1fr_.9fr] md:py-28">
        <div className="max-w-3xl text-center md:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-amber-200">
            <Sparkles className="h-3.5 w-3.5" />
            Sistema operativo de negocio con IA
          </span>
          <h1 className="mt-6 font-serif text-4xl leading-tight tracking-tight md:text-6xl">
            Finanzas, CRM y un asistente que <em className="text-amber-300 not-italic">piensa por vos</em>.
          </h1>
          <p className="mt-6 text-lg text-slate-300 md:text-xl">
            Ferova One reemplaza tu hoja de cálculo, tu CRM y tu agenda con una sola plataforma que aprende de tu negocio y te dice qué hacer cada día.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row md:justify-start">
            <Link
              to="/app"
              onClick={() => trackEvent('hero_primary_cta', { path: '/' })}
              className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-6 py-3 font-medium text-slate-950 hover:bg-amber-200"
            >
              Empezar ahora <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#modulos"
              onClick={() => trackEvent('hero_demo_open', { path: '/' })}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 font-medium text-white hover:bg-white/5"
            >
              Ver demos
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-400">Founder Access USD 39 / mes · {remaining !== null ? <span className="font-semibold text-amber-300">{remaining} de 20 cupos disponibles</span> : '20 cupos totales'} · Sin permanencia</p>
        </div>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="order-first md:order-none"
        >
          <HeroOrbit />
        </motion.div>
      </div>
    </section>
  );
}

function SocialProof() {
  const items = [
    { k: '6', v: 'módulos integrados' },
    { k: '1', v: 'asistente IA siempre activo' },
    { k: '100%', v: 'de tus datos, tuyos' },
    { k: '24/7', v: 'operación autónoma' },
  ];
  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
        {items.map((i, index) => (
          <motion.div
            key={i.v}
            className="text-center"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
          >
            <div className="font-serif text-3xl text-slate-900">{i.k}</div>
            <div className="mt-1 text-xs uppercase tracking-widest text-slate-500">{i.v}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/** Flujo continuo: comunica que los módulos trabajan juntos, no son pantallas aisladas. */
function LiveWorkflow() {
  const reduceMotion = useReducedMotion();
  const updates = [
    ['Agenda', 'Bloque protegido', 'bg-violet-100 text-violet-800'],
    ['IA', 'Priorizó 3 tareas', 'bg-amber-100 text-amber-800'],
    ['CRM', 'Follow-up listo', 'bg-blue-100 text-blue-800'],
    ['Finanzas', 'Flujo actualizado', 'bg-emerald-100 text-emerald-800'],
    ['Horas', 'Registro sincronizado', 'bg-rose-100 text-rose-800'],
  ];
  const flow = [...updates, ...updates];

  return (
    <section className="overflow-hidden border-b border-slate-200 bg-white py-5">
      <div className="mx-auto flex max-w-6xl items-center gap-5 px-4">
        <div className="hidden shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[#981737] sm:flex">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#981737] opacity-50" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#981737]" /></span>
          Ferova en movimiento
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
          <motion.div
            className="flex w-max gap-3 pr-3"
            animate={reduceMotion ? undefined : { x: ['-50%', '0%'] }}
            transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          >
            {flow.map(([module, event, tone], index) => (
              <div key={`${module}-${index}`} className="flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs shadow-sm">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${tone}`}>{module}</span>
                <span className="text-slate-600">{event}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ModulesGrid() {
  const modules = [
    { icon: Brain, title: 'Smart Planner', desc: 'Agenda por energía. Brain dump, priorización y reprogramación automática.', color: 'bg-violet-100 text-violet-700' },
    { icon: LineChart, title: 'Finanzas operativas', desc: 'Ingresos, egresos, impuestos y flujo de caja proyectado. IVA colombiano soportado.', color: 'bg-emerald-100 text-emerald-700' },
    { icon: Users, title: 'CRM inteligente', desc: 'Prospectos, oportunidades, enriquecimiento con Apollo y outreach generado por IA.', color: 'bg-blue-100 text-blue-700' },
    { icon: MessageSquare, title: 'WhatsApp con memoria', desc: 'Conecta tu número, responde con IA y registra cada conversación como oportunidad.', color: 'bg-teal-100 text-teal-700' },
    { icon: CalendarClock, title: 'Calendar sync', desc: 'Sincroniza Google Calendar y tu link de reserva. Nada se te pasa.', color: 'bg-orange-100 text-orange-700' },
    { icon: Bot, title: 'Asistente ejecutivo', desc: 'Panel lateral siempre presente que ve tus datos y te da la siguiente jugada.', color: 'bg-amber-100 text-amber-700' },
  ];
  return (
    <section id="modulos" className="mx-auto max-w-6xl px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-serif text-3xl md:text-4xl">Un módulo para cada parte del negocio</h2>
        <p className="mt-3 text-slate-600">Todos conectados. Toda tu operación en una sola pantalla.</p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m, index) => (
          <motion.div
            key={m.title}
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-[#981737]/35"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ y: -7, rotateX: 2, rotateY: index % 2 ? -2 : 2 }}
            viewport={{ once: true, margin: '-70px' }}
            transition={{ duration: 0.35, delay: (index % 3) * 0.07, ease: 'easeOut' }}
            style={{ transformPerspective: 900 }}
          >
            <div className={`grid h-10 w-10 place-items-center rounded-lg ${m.color}`}>
              <m.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-semibold">{m.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{m.desc}</p>
            <ArrowRight className="mt-5 h-4 w-4 text-[#981737] opacity-0 transition duration-300 group-hover:translate-x-1 group-hover:opacity-100" />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function DemoFrame({
  id, eyebrow, title, desc, children, reverse = false,
}: { id: string; eyebrow: string; title: string; desc: string; children: React.ReactNode; reverse?: boolean }) {
  return (
    <section id={id} className="border-t border-slate-200 bg-slate-50">
      <div className={`mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-2 ${reverse ? 'md:[&>div:first-child]:order-2' : ''}`}>
        <Reveal>
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-600">{eyebrow}</span>
          <h2 className="mt-2 font-serif text-3xl md:text-4xl">{title}</h2>
          <p className="mt-3 text-slate-600">{desc}</p>
        </Reveal>
        <motion.div
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,.1)]"
          initial={{ opacity: 0, y: 28, rotateX: 3 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          whileHover={{ y: -4, rotateX: 1 }}
          viewport={{ once: true, margin: '-70px' }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{ transformPerspective: 1100 }}
        >{children}</motion.div>
      </div>
    </section>
  );
}

function PlannerDemo() {
  const blocks = [
    { t: '09:00', label: 'Focus profundo — Cerrar propuesta Nova', tone: 'bg-violet-50 border-violet-200 text-violet-900', tag: 'Energía alta' },
    { t: '11:00', label: 'Llamada Mariana (CRM warm)', tone: 'bg-blue-50 border-blue-200 text-blue-900', tag: 'Reunión' },
    { t: '14:00', label: 'Admin ligera — Facturar octubre', tone: 'bg-slate-50 border-slate-200 text-slate-700', tag: 'Energía baja' },
    { t: '16:30', label: 'Espacio protegido — Estrategia Q1', tone: 'bg-amber-50 border-amber-200 text-amber-900', tag: 'Bloqueado' },
  ];
  return (
    <DemoFrame
      id="planner"
      eyebrow="Smart Planner"
      title="Tu día, planeado por tu energía"
      desc="Escribís lo que tenés en la cabeza. La IA lo clasifica, lo prioriza y lo distribuye en tu agenda respetando cuándo pensás mejor."
    >
      <div className="space-y-2">
        {blocks.map((b, index) => (
          <motion.div
            key={b.t}
            className={`flex items-center gap-3 rounded-xl border p-3 ${b.tone}`}
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.28, delay: index * 0.08 }}
            whileHover={{ x: 4, scale: 1.01 }}
          >
            <span className="w-14 font-mono text-xs opacity-70">{b.t}</span>
            <span className="flex-1 text-sm font-medium">{b.label}</span>
            <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] uppercase tracking-wide">{b.tag}</span>
          </motion.div>
        ))}
        <div className="mt-4 rounded-xl bg-slate-900 p-3 text-xs text-slate-300">
          <span className="text-amber-300">IA:</span> Detecté 2 tareas pendientes de ayer. ¿Las corro a mañana temprano?
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
    <DemoFrame
      id="finance"
      eyebrow="Finanzas operativas"
      title="Lo que ganás, lo que debés, lo que viene"
      desc="Importa desde Google Sheets, registra ventas y egresos, y ve tu salud financiera en tiempo real. Impuestos colombianos calculados automáticamente."
      reverse
    >
      <div className="space-y-2">
        {rows.map((r, index) => (
          <motion.div
            key={r.c}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.28, delay: index * 0.08 }}
            whileHover={{ x: 4 }}
          >
            <div>
              <div className="text-xs text-slate-500">{r.c}</div>
              <div className="font-serif text-lg">{r.v}</div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs ${r.up ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
              {r.d}
            </span>
          </motion.div>
        ))}
      </div>
    </DemoFrame>
  );
}

function CrmDemo() {
  const leads = [
    { n: 'Nova Studio', s: 'Propuesta enviada', temp: 'Caliente', tone: 'bg-red-100 text-red-700' },
    { n: 'Marca Alfa', s: 'Esperando decisión', temp: 'Tibio', tone: 'bg-amber-100 text-amber-800' },
    { n: 'Ecomm Delta', s: 'Primer contacto', temp: 'Frío', tone: 'bg-slate-100 text-slate-700' },
  ];
  return (
    <DemoFrame
      id="crm"
      eyebrow="CRM"
      title="Prospectos enriquecidos, outreach hecho"
      desc="Pega un dominio o una lista de correos. Apollo trae la info, la IA escribe el primer mensaje y vos aprobás."
    >
      <div className="space-y-2">
        {leads.map((l, index) => (
          <motion.div
            key={l.n}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.28, delay: index * 0.08 }}
            whileHover={{ x: 4 }}
          >
            <div>
              <div className="font-medium">{l.n}</div>
              <div className="text-xs text-slate-500">{l.s}</div>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs ${l.tone}`}>{l.temp}</span>
          </motion.div>
        ))}
        <button
          type="button"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white"
        >
          <Zap className="h-4 w-4 text-amber-300" /> Generar outreach con IA
        </button>
      </div>
    </DemoFrame>
  );
}

function AiDemo() {
  return (
    <DemoFrame
      id="ai"
      eyebrow="Asistente ejecutivo"
      title="Una IA que ve tu negocio entero"
      desc="No es un chatbot genérico. El asistente lee tus finanzas, tu CRM y tu agenda, y te dice qué está fallando antes de que lo notes."
      reverse
    >
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-medium text-slate-900">Vos:</span> ¿Cómo vamos este mes?
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span className="font-medium">IA:</span> Ingresos +12% vs. septiembre, pero <b>3 oportunidades</b> del CRM llevan más de 7 días sin movimiento. La más grande vale $ 4.2M. ¿Te preparo el follow-up?
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Target className="h-3.5 w-3.5" /> Proactivo · <TrendingUp className="h-3.5 w-3.5" /> Contextual · <ShieldCheck className="h-3.5 w-3.5" /> Privado
        </div>
      </div>
    </DemoFrame>
  );
}

const FOUNDER_TOTAL_SLOTS = 20;

/**
 * Cupos Founder reales: cuenta suscripciones activas via RPC publica
 * (founder_slots_taken, solo devuelve un entero). Nada inventado: si la
 * consulta falla, no se muestra numero en vez de fingir uno.
 */
function useFounderSlots() {
  const [taken, setTaken] = useState<number | null>(null);
  useEffect(() => {
    void supabase.rpc('founder_slots_taken').then(({ data, error }) => {
      if (!error && typeof data === 'number') setTaken(data);
    });
  }, []);
  if (taken === null) return null;
  return Math.max(0, FOUNDER_TOTAL_SLOTS - Math.min(taken, FOUNDER_TOTAL_SLOTS));
}

function Pricing() {
  const remaining = useFounderSlots();
  const features = [
    'Todos los módulos incluidos',
    'Asistente IA sin límite razonable',
    'Google Calendar, Sheets y WhatsApp',
    'CRM + enriquecimiento Apollo',
    'Soporte por correo',
  ];
  const sectionRef = useInViewOnce<HTMLElement>(() => trackEvent('pricing_view', { path: '/' }));
  return (
    <section id="precios" ref={sectionRef} className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h2 className="font-serif text-3xl md:text-4xl">Founder Access. Todo incluido.</h2>
        <p className="mt-3 text-slate-600">Primera cohorte limitada a 20 usuarios. La disponibilidad real se confirma al pagar.</p>
        <motion.div
          className="mx-auto mt-10 max-w-md rounded-3xl border border-slate-200 bg-slate-50 p-8 text-left shadow-[0_22px_55px_rgba(15,23,42,.12)]"
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -6, scale: 1.015 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="mb-4 flex items-center justify-between rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"><span>Founder Access</span><span>{remaining !== null ? `${remaining} de ${FOUNDER_TOTAL_SLOTS} cupos disponibles` : '20 cupos totales'}</span></div>
          {remaining !== null && (
            <div className="mb-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${((FOUNDER_TOTAL_SLOTS - remaining) / FOUNDER_TOTAL_SLOTS) * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-amber-800">{FOUNDER_TOTAL_SLOTS - remaining} cupos ya ocupados · el precio Founder se congela para siempre</p>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-5xl">USD 39</span>
            <span className="text-slate-500">/ mes</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Facturado mensualmente. Cancelás cuando quieras.</p>
          <ul className="mt-6 space-y-2">
            {features.map((f, index) => (
              <motion.li
                key={f}
                className="flex items-start gap-2 text-sm"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.25, delay: index * 0.06 }}
              >
                <Check className="mt-0.5 h-4 w-4 text-emerald-600" /> {f}
              </motion.li>
            ))}
          </ul>
          <Link
            to="/app"
            onClick={() => trackEvent('pricing_cta', { path: '/' })}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 font-medium text-white hover:bg-slate-800"
          >
            Empezar ahora <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function Faq() {
  const qa = [
    { q: '¿Necesito instalar algo?', a: 'No. Ferova One es 100% web. Iniciás sesión con Google y ya está.' },
    { q: '¿Mis datos están seguros?', a: 'Sí. Cada cuenta está aislada por permisos a nivel de base de datos. Solo vos ves tus datos.' },
    { q: '¿Funciona fuera de Colombia?', a: 'Sí. La calculadora de impuestos está preparada para Colombia; el resto de módulos funciona en cualquier país.' },
    { q: '¿Puedo cancelar?', a: 'Cuando quieras. Sin permanencia, sin penalidades.' },
  ];
  return (
    <section id="faq" className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center font-serif text-3xl md:text-4xl">Preguntas frecuentes</h2>
        <div className="mt-10 space-y-3">
          {qa.map((i) => (
            <details key={i.q} className="group rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer list-none font-medium">
                <span className="flex items-center justify-between">
                  {i.q}
                  <span className="ml-4 text-slate-400 group-open:rotate-45 transition">+</span>
                </span>
              </summary>
              <p className="mt-2 text-sm text-slate-600">{i.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 md:flex-row">
        <div>© {new Date().getFullYear()} Ferova One. Todos los derechos reservados.</div>
        <div className="flex gap-4">
          <Link to="/terminos" className="hover:text-slate-900">Términos</Link>
          <Link to="/privacidad" className="hover:text-slate-900">Privacidad</Link>
        </div>
      </div>
    </footer>
  );
}

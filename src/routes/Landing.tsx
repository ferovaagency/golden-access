import { useEffect, useRef, useState } from "react";
import { DemoVideo } from "../marketing/landing/DemoVideo";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  FolderKanban,
  Menu,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { SeoHead } from "../seo/SeoHead";
import {
  organizationSchema,
  websiteSchema,
  softwareApplicationSchema,
} from "../seo/StructuredData";
import { getPlanCatalog, TRIAL_DAYS } from "../lib/planService";
import { trackEvent } from "../lib/analytics";
import { FerovaBrand } from "../marketing/landing/FerovaBrand";
import { ProductPreview } from "../marketing/landing/ProductPreview";
import { LandingPricing } from "../marketing/landing/LandingPricing";
import { HOME_DESCRIPTION, HOME_FAQ, HOME_TITLE } from "../marketing/landing/content";
import "../marketing/landing/landing.css";

// Recorrido de la página (consultoría ID 1840, E4 §3): valor → problema →
// beneficios → funcionalidades y demo → cómo empezar → planes → FAQ → cierre.
const steps = [
  {
    n: "01",
    title: "Elige tu plan.",
    text: "Selecciona el nivel que se ajusta a tu negocio. Los primeros 7 días son gratis y sin tarjeta.",
  },
  {
    n: "02",
    title: "Configura tu información.",
    text: "En cinco pasos cargas tu empresa, tus servicios, tus clientes y tus costos fijos. Al terminar ya tienes tu punto de equilibrio.",
  },
  {
    n: "03",
    title: "Gestiona con mayor claridad.",
    text: "Registra horas, ingresos y gastos; revisa precios recomendados y decide con números, no con intuición.",
  },
];

const beneficios = [
  {
    icon: Wallet,
    title: "Controla tu rentabilidad",
    text: "Relaciona costos, horas y metas para establecer tarifas con criterios económicos, servicio por servicio.",
  },
  {
    icon: CalendarDays,
    title: "Organiza tu trabajo",
    text: "Administra proyectos, tareas y compromisos desde un entorno integrado, con una agenda que protege tu tiempo.",
  },
  {
    icon: FolderKanban,
    title: "Gestiona tus oportunidades",
    text: "Centraliza la información de tus clientes y da seguimiento a tus actividades comerciales sin otra herramienta.",
  },
  {
    icon: Sparkles,
    title: "Apóyate en inteligencia artificial",
    text: "Planificación y análisis asistidos por IA para entender tus números y decidir el siguiente paso.",
  },
];

function TrialLink({
  source,
  children = "Empezar mis 7 días gratis",
  className = "fo-button-primary",
}: {
  source: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      className={`fo-button ${className}`}
      href="#precios"
      onClick={() => trackEvent("hero_primary_cta", { path: "/", source })}
    >
      {children}
      <ArrowRight size={17} aria-hidden="true" />
    </a>
  );
}

function LandingHeader() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  const closeMenu = () => setOpen(false);
  return (
    <header className="fo-header">
      <div className="fo-container fo-header-inner">
        <FerovaBrand />
        <nav className="fo-desktop-nav" aria-label="Navegación principal">
          <a href="#producto">Producto</a>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#precios">Precios</a>
          <Link to="/blog">Recursos</Link>
        </nav>
        <div className="fo-header-actions">
          <Link
            className="fo-login"
            to="/app"
            onClick={() => trackEvent("login_click", { path: "/", source: "header" })}
          >
            Entrar
          </Link>
          <TrialLink source="header">Probar gratis</TrialLink>
          <button
            ref={menuButton}
            type="button"
            className="fo-menu-button"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="landing-mobile-menu" className="fo-mobile-nav" aria-label="Navegación móvil">
          <a href="#producto" onClick={closeMenu}>
            Producto
          </a>
          <a href="#como-funciona" onClick={closeMenu}>
            Cómo funciona
          </a>
          <a href="#precios" onClick={closeMenu}>
            Planes y precios
          </a>
          <Link to="/blog" onClick={closeMenu}>
            Recursos
          </Link>
          <Link to="/app" onClick={closeMenu}>
            Iniciar sesión <ArrowUpRight size={16} />
          </Link>
        </nav>
      )}
    </header>
  );
}

export default function Landing() {
  const startingPrice = getPlanCatalog()[0].precioMensual;
  useEffect(() => {
    let active = true;
    // Preserve OAuth returns without loading the auth client in the server render.
    void import("../lib/supabase")
      .then(async ({ supabase, consumePostLoginReturn }) => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (active && data.session?.user && consumePostLoginReturn() === "/app")
          window.location.replace("/app");
      })
      .catch(() => {
        if (import.meta.env.DEV)
          console.warn("No se pudo comprobar la sesión; el acceso sigue disponible en /app.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="fo-landing">
      <SeoHead
        title={HOME_TITLE}
        description={HOME_DESCRIPTION}
        path="/"
        jsonLd={[
          organizationSchema(),
          websiteSchema(),
          softwareApplicationSchema({ price: String(startingPrice), priceCurrency: "USD" }),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: HOME_FAQ.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          },
        ]}
      />
      <a className="fo-skip" href="#contenido">
        Saltar al contenido
      </a>
      <LandingHeader />
      <main id="contenido">
        <section className="fo-hero fo-container" aria-labelledby="hero-title">
          <div className="fo-hero-copy">
            <p className="fo-eyebrow">
              <span aria-hidden="true" />
              PARA FREELANCERS Y PROFESIONALES INDEPENDIENTES
            </p>
            <h1 id="hero-title">
              Deja de adivinar
              <br />
              <span>cuánto cobrar.</span>
            </h1>
            <p className="fo-hero-subtitle">Conoce tus costos. Organiza tu trabajo. Mejora tus decisiones.</p>
            <p className="fo-hero-description">
              Ferova One reúne finanzas, proyectos, CRM e inteligencia artificial para ayudarte a
              gestionar tu negocio independiente desde un solo lugar.
            </p>
            <div className="fo-hero-ctas">
              <TrialLink source="hero_explorar_planes">Explorar planes</TrialLink>
              <a
                href="#demo"
                className="fo-demo-link"
                onClick={() => trackEvent("hero_demo_open", { path: "/" })}
              >
                Ver demostración <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
            <p className="fo-trust">
              <Check size={15} aria-hidden="true" /> Sin tarjeta <span>·</span> Sin instalaciones{" "}
              <span>·</span> Desde USD {startingPrice}/mes
            </p>
            <div className="fo-hero-foot">
              <span className="fo-small-monogram" aria-hidden="true">
                f.
              </span>
              <p>
                Hecho para freelancers, consultores
                <br />y pequeñas agencias.
              </p>
            </div>
          </div>
          <div className="fo-hero-visual">
            <div className="fo-preview-label">
              <span className="fo-small-label">MENOS PESTAÑAS. MÁS PERSPECTIVA.</span>
              <span aria-hidden="true">↘</span>
            </div>
            <ProductPreview />
            <div className="fo-preview-below">
              <span aria-hidden="true">✦</span> Tu operación conectada, de principio a fin.
            </div>
          </div>
        </section>
        <div className="fo-connection-strip">
          <div className="fo-container">
            <span>Todo lo que mueve tu negocio.</span>
            <span>
              <FolderKanban size={17} />
              Proyectos
            </span>
            <span>
              <Clock3 size={17} />
              Horas
            </span>
            <span>
              <Wallet size={17} />
              Finanzas
            </span>
            <span>
              <CalendarDays size={17} />
              Planner
            </span>
            <span>
              <Sparkles size={17} />
              Asistente IA
            </span>
          </div>
        </div>
        <section id="problema" className="fo-section fo-container fo-problem" aria-labelledby="problema-title">
          <div className="fo-section-heading">
            <div>
              <p className="fo-eyebrow">EL PROBLEMA</p>
              <h2 id="problema-title">
                Tu talento tiene valor.
                <br />
                ¿Sabes cuánto ganas realmente con cada proyecto?
              </h2>
            </div>
            <p>
              Cuando trabajas de manera independiente, administrar clientes, proyectos, horas, costos
              y pagos se vuelve una tarea más. Si esa información está dispersa, es difícil fijar
              tarifas adecuadas y saber qué servicio te deja margen y cuál te lo quita. Ferova One
              conecta esas piezas para que gestiones tu actividad con claridad.
            </p>
          </div>
        </section>
        <section id="beneficios" className="fo-section fo-container" aria-labelledby="beneficios-title">
          <div className="fo-section-heading">
            <div>
              <p className="fo-eyebrow">LO QUE GANAS</p>
              <h2 id="beneficios-title">
                Más control sobre tu negocio.
                <br />
                Más claridad para decidir.
              </h2>
            </div>
            <p>Cuatro resultados concretos, sin prometer cifras que dependen de tu trabajo.</p>
          </div>
          <div className="fo-four">
            {beneficios.map((b) => (
              <article key={b.title} className="fo-four-card">
                <div className="fo-feature-icon">
                  <b.icon size={22} />
                </div>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="producto" className="fo-section fo-container">
          <div className="fo-section-heading">
            <div>
              <p className="fo-eyebrow">FUNCIONALIDADES</p>
              <h2>
                Las herramientas que necesitas
                <br />
                para tu negocio independiente.
              </h2>
            </div>
            <p>
              Cuatro bloques: finanzas y rentabilidad, proyectos y planificación, clientes y
              oportunidades, e inteligencia de negocio. Todo con tus datos reales.
            </p>
          </div>
          <div className="fo-benefits">
            <article className="fo-benefit fo-benefit-finance">
              <div className="fo-feature-icon">
                <Wallet size={23} />
              </div>
              <h3>
                Finanzas y
                <br />
                rentabilidad.
              </h3>
              <p>
                Ingresos, gastos, costos y resultado por servicio. Precio recomendado, punto de
                equilibrio y cuentas por cobrar en un solo lugar.
              </p>
              <div className="fo-profit-example">
                <div>
                  <span>Proyecto de identidad</span>
                  <span>Ejemplo · COP</span>
                </div>
                <div>
                  <span>Ingreso registrado</span>
                  <b>$2.400.000</b>
                </div>
                <div>
                  <span>Costos registrados</span>
                  <b>$900.000</b>
                </div>
                <div className="fo-profit-total">
                  <span>Margen antes de otros gastos</span>
                  <b>$1.500.000</b>
                </div>
              </div>
              <Link to="/funciones/finanzas">
                Conocer las finanzas <ArrowUpRight size={16} />
              </Link>
            </article>
            <article className="fo-benefit">
              <div className="fo-feature-icon">
                <CalendarDays size={23} />
              </div>
              <h3>
                Proyectos y
                <br />
                planificación.
              </h3>
              <p>
                Tareas con cliente y fecha, registro de horas y un Smart Planner que prioriza por
                impacto y protege tu agenda.
              </p>
              <div className="fo-agenda-example" aria-label="Ejemplo de agenda">
                <span>09:00</span>
                <div>
                  <b>Identidad · Estudio Norte</b>
                  <small>Trabajo enfocado · 90 min</small>
                </div>
                <span>11:00</span>
                <div>
                  <b>Revisión con Casa Oliva</b>
                  <small>Reunión · 30 min</small>
                </div>
              </div>
              <Link to="/funciones/planner">
                Explorar el Planner <ArrowUpRight size={16} />
              </Link>
            </article>
            <article className="fo-benefit">
              <div className="fo-feature-icon">
                <FolderKanban size={23} />
              </div>
              <h3>
                Clientes y
                <br />
                oportunidades.
              </h3>
              <p>
                Clientes, objetivos, entregables y seguimiento comercial juntos. El CRM se activa a
                partir del plan Intermedio.
              </p>
              <div className="fo-client-example">
                <span className="fo-client-avatar">N</span>
                <div>
                  <b>Estudio Norte</b>
                  <small>Identidad de marca · ejemplo</small>
                </div>
                <span className="fo-tag">En marcha</span>
              </div>
              <div className="fo-client-checks">
                <span>
                  <Check size={15} />
                  Cliente y servicio
                </span>
                <span>
                  <Check size={15} />
                  Objetivos y entregables
                </span>
                <span>
                  <Check size={15} />
                  Horas e ingresos
                </span>
              </div>
              <Link to="/funciones">
                Ver todas las funciones <ArrowUpRight size={16} />
              </Link>
            </article>
          </div>
        </section>
        <section className="fo-ai-section">
          <div className="fo-container fo-ai-grid">
            <div>
              <p className="fo-eyebrow">INTELIGENCIA DE NEGOCIO</p>
              <h2>
                Una segunda mirada.
                <br />
                <span>Con el contexto de tu negocio.</span>
              </h2>
              <p>
                El asistente de Ferova One usa la información registrada para ayudarte a entender
                tus números y pensar el siguiente paso.
              </p>
              <Link to="/funciones/asistente-ia" className="fo-text-link">
                Conocer el asistente <ArrowRight size={17} />
              </Link>
            </div>
            <div className="fo-ai-conversation">
              <div className="fo-ai-person">
                <span className="fo-avatar">Tú</span>
                <p>¿En qué debería enfocarme hoy?</p>
              </div>
              <div className="fo-ai-answer">
                <img src="/brand/ferova-isotipo.png" width="24" height="30" alt="" loading="lazy" />
                <div>
                  <b>Empecemos por lo que tienes pendiente.</b>
                  <p>
                    Revisa tus cobros, las tareas prioritarias y el avance de tus proyectos. Con tus
                    registros, podemos poner esas decisiones en contexto.
                  </p>
                </div>
              </div>
              <p className="fo-example-disclaimer">
                Conversación ilustrativa. Revisa las respuestas y las cifras antes de tomar
                decisiones.
              </p>
            </div>
          </div>
        </section>
        <section id="demo" className="fo-section fo-container fo-demo" aria-labelledby="demo-title">
          <div className="fo-section-heading">
            <div>
              <p className="fo-eyebrow">DEMOSTRACIÓN REAL · SIN MAQUETAS</p>
              <h2 id="demo-title">
                Así se ve
                <br />
                por dentro.
              </h2>
            </div>
            <p>
              Grabación real de Ferova One, sin montajes: de los costos del negocio al precio que
              deberías cobrar y a cómo cerró el mes.
            </p>
          </div>
          <DemoVideo />
        </section>
        <section id="como-funciona" className="fo-section fo-container">
          <div className="fo-section-heading">
            <div>
              <p className="fo-eyebrow">CÓMO EMPEZAR</p>
              <h2>
                Empieza a organizar tu negocio
                <br />
                en tres pasos.
              </h2>
            </div>
            <p>
              Sin configurar todo el primer día: con un cliente, un servicio y tus costos fijos ya
              tienes tu primer número real.
            </p>
          </div>
          <div className="fo-steps">
            {steps.map((step) => (
              <article key={step.n}>
                <span>{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
          <div className="fo-center">
            <TrialLink source="how_it_works">Elegir mi plan de prueba</TrialLink>
          </div>
        </section>
        <section className="fo-section fo-container fo-testimonial" aria-labelledby="testimonio-title">
          <p className="fo-eyebrow">LO DICEN QUIENES YA LO USAN</p>
          <h2 id="testimonio-title" className="fo-sr-only">Testimonios</h2>
          <figure className="fo-quote">
            <blockquote>
              <p>“Estoy usando la plataforma y está muy, muy top. Me centralizo todo.”</p>
            </blockquote>
            <figcaption>
              <strong>Juan</strong>
              <span>Consultor de pauta paga y rentabilidad en ecommerce · usuario de Ferova One</span>
            </figcaption>
          </figure>
        </section>
        <section id="precios" className="fo-pricing-section">
          <div className="fo-container">
            <div className="fo-heading-centered">
              <p className="fo-eyebrow">UN PLAN PARA TU MOMENTO</p>
              <h2>
                Empieza por claridad.
                <br />
                Crece a tu ritmo.
              </h2>
              <p>
                Elige según los clientes que atiendes y las herramientas que necesitas.
                <br />
                Pruébalo {TRIAL_DAYS} días sin tarjeta.
              </p>
            </div>
            <LandingPricing />
          </div>
        </section>
        <section id="preguntas" className="fo-section fo-container fo-faq">
          <div>
            <p className="fo-eyebrow">PREGUNTAS FRECUENTES</p>
            <h2>
              Las cosas claras,
              <br />
              desde aquí.
            </h2>
            <p>Suscripción, planes, cancelación y condiciones, sin letra pequeña.</p>
            <Link to="/seguridad" className="fo-text-link">
              <ShieldCheck size={17} /> Cómo cuidamos tus datos
            </Link>
          </div>
          <div>
            {HOME_FAQ.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="fo-final-cta fo-container">
          <div>
            <p className="fo-eyebrow">EMPIEZA HOY</p>
            <h2>
              Cobra con criterio.
              <br />
              <span>Decide con tus números.</span>
            </h2>
            <p>Elige tu plan y prueba Ferova One con tu propio negocio.</p>
            <TrialLink source="footer" className="fo-button-light">Explorar planes y empezar gratis</TrialLink>
            <p className="fo-final-note">
              {TRIAL_DAYS} días gratis · Sin tarjeta · Tú decides si continúas
            </p>
          </div>
          <img src="/brand/ferova-isotipo.png" width="230" height="283" alt="" loading="lazy" />
        </section>
      </main>
      <footer className="fo-footer fo-container">
        <div className="fo-footer-top">
          <div>
            <FerovaBrand />
            <p>
              Tu talento mueve el negocio.
              <br />
              Ferova One te ayuda a llevarlo.
            </p>
          </div>
          <nav aria-label="Producto">
            <b>Producto</b>
            <Link to="/funciones/finanzas">Finanzas</Link>
            <Link to="/funciones/planner">Planner</Link>
            <Link to="/funciones/crm">CRM</Link>
            <Link to="/precios">Planes y precios</Link>
          </nav>
          <nav aria-label="Recursos">
            <b>Recursos</b>
            <Link to="/blog">Guías para tu negocio</Link>
            <Link to="/blog/cliente-rentable">Rentabilidad por cliente</Link>
            <Link to="/novedades">Novedades</Link>
            <Link to="/seguridad">Seguridad</Link>
          </nav>
          <nav aria-label="Legal">
            <b>Legal</b>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/terminos">Términos</Link>
            <Link to="/reembolsos">Reembolsos</Link>
            <Link to="/subencargados">Subencargados</Link>
          </nav>
        </div>
        <div className="fo-footer-bottom">
          <span>© {new Date().getFullYear()} Ferova One · Un producto de Ferova.</span>
          <span>Hecho para trabajar con claridad.</span>
        </div>
      </footer>
    </div>
  );
}

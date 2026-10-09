import { useEffect, useRef, useState } from "react";
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

const steps = [
  {
    n: "01",
    title: "Ponle nombre a tu trabajo.",
    text: "Añade tus clientes y servicios. Empieza con lo que ya tienes, sin configurar todo el negocio de una vez.",
  },
  {
    n: "02",
    title: "Conecta tiempo y dinero.",
    text: "Registra horas, ingresos y gastos. Cada dato aporta contexto para entender tus proyectos.",
  },
  {
    n: "03",
    title: "Decide con más claridad.",
    text: "Revisa tus números y organiza el siguiente paso. Lo importante deja de depender de tu memoria.",
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
              PARA QUIENES VIVEN DE SU TALENTO
            </p>
            <h1 id="hero-title">
              Tu negocio, claro.
              <br />
              <span>Tu tiempo, tuyo.</span>
            </h1>
            <p className="fo-hero-description">
              Clientes, proyectos y finanzas en un solo lugar. Entiende lo que ganas con tu trabajo
              y enfócate en lo que sigue.
            </p>
            <div className="fo-hero-ctas">
              <TrialLink source="hero" />
              <a
                href="#demo"
                className="fo-demo-link"
                onClick={() => trackEvent("hero_demo_open", { path: "/" })}
              >
                Explorar la demo <ArrowUpRight size={16} aria-hidden="true" />
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
        <section id="producto" className="fo-section fo-container">
          <div className="fo-section-heading">
            <div>
              <p className="fo-eyebrow">EL TRABAJO YA ES SUFICIENTE TRABAJO</p>
              <h2>
                Que llevar tu negocio
                <br />
                no sea otro proyecto.
              </h2>
            </div>
            <p>
              Tu información suele terminar repartida entre una hoja, una agenda y tu cabeza. Ferova
              One te ayuda a conectarla.
            </p>
          </div>
          <div className="fo-benefits">
            <article className="fo-benefit fo-benefit-finance">
              <div className="fo-feature-icon">
                <Wallet size={23} />
              </div>
              <h3>
                Que facturar más
                <br />
                también tenga sentido.
              </h3>
              <p>
                Relaciona ingresos, costos y horas. Entiende qué cliente merece más de tu tiempo y
                qué servicio necesita un ajuste.
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
                De mil pendientes
                <br />a un siguiente paso.
              </h3>
              <p>
                Reúne tus tareas, revisa prioridades y organiza tu agenda. Registra el tiempo que
                dedicas a cada cliente.
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
                El contexto completo.
                <br />
                Sin volver a preguntar.
              </h3>
              <p>
                Clientes, objetivos, entregables y seguimiento juntos. Conecta tu operación con el
                CRM a partir del plan Intermedio.
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
              <p className="fo-eyebrow">UN POCO DE PERSPECTIVA EXTRA</p>
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
        <section id="como-funciona" className="fo-section fo-container">
          <div className="fo-section-heading">
            <div>
              <p className="fo-eyebrow">EMPIEZA PEQUEÑO. GANA CLARIDAD.</p>
              <h2>
                No tienes que organizarlo
                <br />
                todo el primer día.
              </h2>
            </div>
            <p>
              Un cliente, un servicio y tu primer registro. Después, construye el hábito a tu ritmo.
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
            <p className="fo-eyebrow">ANTES DE EMPEZAR</p>
            <h2>
              Las cosas claras,
              <br />
              desde aquí.
            </h2>
            <p>Sin letras pequeñas sobre tu prueba.</p>
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
            <p className="fo-eyebrow">HAZLE ESPACIO A LO QUE SIGUE</p>
            <h2>
              Menos administrar.
              <br />
              <span>Más hacer lo tuyo.</span>
            </h2>
            <p>Tu trabajo merece un negocio que lo acompañe.</p>
            <TrialLink source="footer" className="fo-button-light" />
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

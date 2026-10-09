import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  FolderKanban,
  Check,
  Circle,
  ChevronRight,
  Clock3,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  X,
  Menu,
} from "lucide-react";
import { trackEvent } from "../../lib/analytics";
import { SeoHead } from "../../seo/SeoHead";
import {
  organizationSchema,
  websiteSchema,
  softwareApplicationSchema,
} from "../../seo/StructuredData";
import { getPlanCatalog, TRIAL_DAYS } from "../../lib/planService";
import { planIntentPath } from "../../lib/planIntent";
import "./landing.css";
function FerovaBrand() {
  return (
    <Link to="/" className="fo-brand" aria-label="Ferova One, inicio">
      <span className="fo-brand-mark">
        <img src="/brand/ferova-isotipo.png" alt="" width="28" height="35" />
      </span>
      <span>
        {"ferova"}
        <span className="fo-brand-one">{"one"}</span>
      </span>
    </Link>
  );
}
const demoViews = [
  {
    id: "hoy",
    label: "Mi día",
    icon: LayoutDashboard,
  },
  {
    id: "finanzas",
    label: "Mi dinero",
    icon: Wallet,
  },
  {
    id: "proyectos",
    label: "Mis proyectos",
    icon: FolderKanban,
  },
];
function ProductPreview() {
  const [view, setView] = useState("hoy");
  const [done, setDone] = useState(false);
  return (
    <div className="fo-preview" id="demo">
      <div className="fo-preview-top">
        <span className="fo-preview-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>{"Tu espacio de trabajo"}</span>
        <span className="fo-live-dot">{"Vista de ejemplo"}</span>
      </div>
      <div className="fo-preview-body">
        <div className="fo-demo-nav" role="group" aria-label="Explorar demostración">
          {demoViews.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              aria-pressed={view === id}
              onClick={() => {
                setView(id);
                trackEvent("module_demo_interaction", {
                  module: id,
                  source: "home_preview",
                });
              }}
              key={id}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div className="fo-demo-content" aria-live="polite">
          <div className="fo-demo-heading">
            <div>
              <span className="fo-small-label">{"ESTUDIO CREATIVO · EJEMPLO"}</span>
              <h2>
                {view === "hoy"
                  ? "Hoy, enfócate en avanzar."
                  : view === "finanzas"
                    ? "Tus números, sin vueltas."
                    : "Todo tiene su lugar."}
              </h2>
            </div>
            <span className="fo-avatar" aria-hidden="true">
              {"E"}
            </span>
          </div>
          <div className="fo-demo-metrics">
            <div>
              <span>{"Ingresos del mes"}</span>
              <strong>{"$8.400.000"}</strong>
              <small>{"COP · ventas registradas"}</small>
            </div>
            <div>
              <span>{"Por cobrar"}</span>
              <strong>{"$2.100.000"}</strong>
              <small>{"2 cobros pendientes"}</small>
            </div>
            <div>
              <span>{"Horas registradas"}</span>
              <strong>
                {"64 "}
                <em>{"h"}</em>
              </strong>
              <small>{"En tus proyectos"}</small>
            </div>
          </div>
          {view === "hoy" && (
            <>
              <div className="fo-demo-section-label">
                <h3>{"Tu siguiente paso"}</h3>
                <span>{done ? "2 de 3 pendientes" : "3 pendientes"}</span>
              </div>
              <button
                type="button"
                className={`fo-task ${done ? "is-done" : ""}`}
                aria-pressed={done}
                onClick={() => {
                  setDone(!done);
                  trackEvent("module_demo_interaction", {
                    module: "complete_demo_task",
                  });
                }}
              >
                <span className="fo-check-circle">
                  {done ? <Check size={14} /> : <Circle size={16} />}
                </span>
                <span>
                  <b>{"Enviar propuesta a Estudio Norte"}</b>
                  <small>{"Proyecto de identidad · 30 min"}</small>
                </span>
                <span className="fo-tag">{done ? "Listo" : "Prioridad"}</span>
              </button>
              <div className="fo-task">
                <span className="fo-check-circle">
                  <Circle size={16} />
                </span>
                <span>
                  <b>{"Revisar el cobro de Casa Oliva"}</b>
                  <small>{"Saldo pendiente · $1.200.000"}</small>
                </span>
                <ChevronRight size={16} />
              </div>
              <div className="fo-task">
                <span className="fo-check-circle">
                  <Circle size={16} />
                </span>
                <span>
                  <b>{"Diseñar la primera propuesta"}</b>
                  <small>{"Estudio Norte · bloque de 90 min"}</small>
                </span>
                <Clock3 size={16} />
              </div>
              <div className="fo-demo-note">
                <span className="fo-note-star" aria-hidden="true">
                  {"✦"}
                </span>
                <p>
                  {"Menos pendientes en tu cabeza."}
                  <br />
                  <b>{"Más claridad para tu siguiente paso."}</b>
                </p>
              </div>
            </>
          )}
          {view === "finanzas" && (
            <>
              <div className="fo-demo-section-label">
                <h3>{"Ingresos y costos registrados"}</h3>
                <span>{"Ejemplo · COP"}</span>
              </div>
              <div
                className="fo-chart"
                role="img"
                aria-label="Ejemplo: ingresos crecen de enero a junio; los costos son menores que los ingresos."
              >
                {[40, 54, 47, 72, 62, 90].map((h, i) => (
                  <div key={i}>
                    <span>
                      <i
                        style={{
                          height: `${h}%`,
                        }}
                      />
                      <i
                        style={{
                          height: `${h * 0.52}%`,
                        }}
                      />
                    </span>
                    <small>{["Ene", "Feb", "Mar", "Abr", "May", "Jun"][i]}</small>
                  </div>
                ))}
              </div>
              <div className="fo-chart-key">
                <span>{"● Ingresos"}</span>
                <span>{"● Costos"}</span>
              </div>
              <p className="fo-demo-footnote">
                {"Cruza lo que cobras, lo que gastas y el tiempo que dedicas."}
              </p>
            </>
          )}
          {view === "proyectos" && (
            <>
              <div className="fo-demo-section-label">
                <h3>{"Proyectos en marcha"}</h3>
                <span>{"2 activos"}</span>
              </div>
              {[
                {
                  name: "Estudio Norte",
                  work: "Identidad de marca",
                  progress: 65,
                },
                {
                  name: "Casa Oliva",
                  work: "Sitio web",
                  progress: 40,
                },
              ].map((p) => (
                <div className="fo-demo-project" key={p.name}>
                  <span>
                    <b>{p.name}</b>
                    <small>{p.work}</small>
                  </span>
                  <span>
                    {p.progress}
                    {"%"}
                  </span>
                  <div className="fo-progress">
                    <i
                      style={{
                        width: `${p.progress}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="fo-demo-note">
                <FolderKanban size={20} />
                <p>
                  {"Cliente, objetivos y entregables."}
                  <br />
                  <b>{"El contexto completo, en un lugar."}</b>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="fo-preview-caption">
        <span>{"Demostración interactiva · datos ficticios"}</span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </div>
    </div>
  );
}
const details = {
  basico: {
    description: "Para poner en orden tu trabajo independiente.",
    features: [
      "Hasta 3 clientes activos",
      "Proyectos, horas y Planner",
      "Ingresos, gastos y control tributario",
      "Google Calendar y Google Sheets",
      "100 consultas de IA al mes",
    ],
  },
  intermedio: {
    description: "Para conectar tu operación con tus ventas.",
    features: [
      "Hasta 10 clientes activos",
      "Todo lo incluido en Básico",
      "CRM y oportunidades de venta",
      "Análisis de Marketing ROI",
      "Mayor capacidad de uso del asistente",
    ],
  },
  full: {
    description: "Para trabajar con tu equipo y varias marcas.",
    features: [
      "Clientes ilimitados",
      "Todo lo incluido en Intermedio",
      "Varias marcas o empresas",
      "Reportes ejecutivos y análisis de negocio",
      "Hasta 10 colaboradores",
    ],
  },
};
function LandingPricing() {
  const [period, setPeriod] = useState("mensual");
  const sectionRef = useRef(null);
  const plans = getPlanCatalog();
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent("pricing_view", {
            path: "/",
            source: "landing_redesign",
          });
          observer.disconnect();
        }
      },
      {
        threshold: 0.15,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={sectionRef}>
      <div className="fo-billing" role="group" aria-label="Período de facturación">
        <button
          type="button"
          aria-pressed={period === "mensual"}
          onClick={() => setPeriod("mensual")}
        >
          {"Mensual"}
        </button>
        <button type="button" aria-pressed={period === "anual"} onClick={() => setPeriod("anual")}>
          {"Anual "}
          <span>
            {"Hasta "}
            {Math.max(...plans.map((p) => p.ahorroAnualPct))}
            {"% menos"}
          </span>
        </button>
      </div>
      <div className="fo-pricing-grid">
        {plans.map((plan) => (
          <article className={`fo-plan ${plan.destacado ? "fo-plan-featured" : ""}`} key={plan.id}>
            <div className="fo-plan-top">
              <span>{plan.etiqueta}</span>
              {plan.destacado && <b>{"Para crecer"}</b>}
            </div>
            <h3>{plan.nombre}</h3>
            <p>{details[plan.id].description}</p>
            <div className="fo-price">
              <span>{"USD"}</span>
              <strong>{period === "anual" ? plan.precioAnualMes : plan.precioMensual}</strong>
              <span>{"/ mes"}</span>
            </div>
            <p className="fo-billing-detail">
              {period === "anual"
                ? `USD ${plan.precioAnualTotal} al año · ahorro de ${plan.ahorroAnualPct}%.`
                : "Facturación mensual."}
              <br />
              {"Después de tus "}
              {TRIAL_DAYS}
              {" días de prueba."}
            </p>
            <Link
              className={`fo-button ${plan.destacado ? "fo-button-primary" : "fo-button-outline"}`}
              to={planIntentPath({
                plan: plan.id,
                periodo: period,
              })}
              onClick={() =>
                trackEvent("pricing_cta", {
                  path: "/",
                  plan: plan.id,
                  periodo: period,
                  source: "landing_redesign",
                })
              }
            >
              {"Probar "}
              {plan.nombre}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <ul>
              {details[plan.id].features.map((feature) => (
                <li key={feature}>
                  <Check size={16} aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <p className="fo-pricing-note">
        {"Todos los planes incluyen "}
        {TRIAL_DAYS}
        {" días gratis, sin tarjeta. Precios en USD antes de impuestos."}
        <br />
        {"Si no añades un método de pago, la prueba termina sin un cobro automático."}{" "}
        <Link to="/precios">
          {"Ver detalles de los planes "}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}
const HOME_TITLE = "Finanzas y proyectos para freelancers";
const HOME_DESCRIPTION =
  "Organiza clientes, proyectos, horas y finanzas con Ferova One. Entiende la rentabilidad de tu trabajo. Prueba 7 días gratis, sin tarjeta.";
const HOME_FAQ = [
  {
    question: "¿Qué es Ferova One y para quién es?",
    answer:
      "Ferova One es una plataforma web que reúne clientes, proyectos, registro de horas, planificación y finanzas. Está pensada para freelancers, consultores y pequeñas agencias que venden servicios y quieren entender la rentabilidad de su trabajo.",
  },
  {
    question: "¿Cómo funcionan los 7 días gratis?",
    answer:
      "Elige un plan y crea tu cuenta. Puedes probarlo durante 7 días sin registrar una tarjeta. Si decides continuar, añade un método de pago desde la aplicación. Si no lo haces, la prueba termina sin un cobro automático.",
  },
  {
    question: "¿Necesito saber contabilidad para empezar?",
    answer:
      "Puedes empezar con tus clientes, servicios, ingresos y gastos. Ferova One organiza los datos que registras y calcula indicadores para ayudarte a tomar decisiones. Sus estimaciones no sustituyen la revisión de un contador.",
  },
  {
    question: "¿Puedo usarlo desde el celular?",
    answer:
      "Sí. Ferova One se abre en el navegador de tu computador, tablet o celular. No necesitas instalar una aplicación. Para configurar información financiera extensa, te recomendamos una pantalla grande.",
  },
  {
    question: "¿Qué diferencia a Ferova One de una hoja de cálculo?",
    answer:
      "En Ferova One, clientes, servicios, horas y movimientos financieros comparten información dentro de la plataforma. Así puedes relacionar el tiempo dedicado con los ingresos y costos de tu trabajo, sin mantener varias hojas separadas.",
  },
  {
    question: "¿Funciona fuera de Colombia?",
    answer:
      "Puedes registrar operaciones en COP y USD. Las herramientas tributarias están orientadas a Colombia; si operas en otro país, revisa las obligaciones locales con tu contador. Los precios de los planes se expresan en USD, antes de impuestos.",
  },
  {
    question: "¿Qué ocurre con mis datos si no continúo?",
    answer:
      "Al terminar la prueba sin un método de pago, el acceso se desactiva y los datos permanecen guardados. Puedes consultar las condiciones de tratamiento, conservación y eliminación en la Política de Privacidad.",
  },
];
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
}) {
  return (
    <a
      className={`fo-button ${className}`}
      href="#precios"
      onClick={() =>
        trackEvent("hero_primary_cta", {
          path: "/",
          source,
        })
      }
    >
      {children}
      <ArrowRight size={17} aria-hidden="true" />
    </a>
  );
}
function LandingHeader() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef(null);
  useEffect(() => {
    if (!open) return;
    const escape = (event) => {
      var _a;
      if (event.key === "Escape") {
        setOpen(false);
        (_a = menuButton.current) == null ? void 0 : _a.focus();
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
          <a href="#producto">{"Producto"}</a>
          <a href="#como-funciona">{"Cómo funciona"}</a>
          <a href="#precios">{"Precios"}</a>
          <Link to="/blog">{"Recursos"}</Link>
        </nav>
        <div className="fo-header-actions">
          <Link
            className="fo-login"
            to="/app"
            onClick={() =>
              trackEvent("login_click", {
                path: "/",
                source: "header",
              })
            }
          >
            {"Entrar"}
          </Link>
          <TrialLink source="header">{"Probar gratis"}</TrialLink>
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
            {"Producto"}
          </a>
          <a href="#como-funciona" onClick={closeMenu}>
            {"Cómo funciona"}
          </a>
          <a href="#precios" onClick={closeMenu}>
            {"Planes y precios"}
          </a>
          <Link to="/blog" onClick={closeMenu}>
            {"Recursos"}
          </Link>
          <Link to="/app" onClick={closeMenu}>
            {"Iniciar sesión "}
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      )}
    </header>
  );
}
function Landing() {
  const startingPrice = getPlanCatalog()[0].precioMensual;
  useEffect(() => {
    let active = true;
    void import("../../lib/supabase")
      .then(async ({ supabase, consumePostLoginReturn }) => {
        var _a;
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (
          active &&
          ((_a = data.session) == null ? void 0 : _a.user) &&
          consumePostLoginReturn() === "/app"
        )
          window.location.replace("/app");
      })
      .catch(() => {});
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
          softwareApplicationSchema({
            price: String(startingPrice),
            priceCurrency: "USD",
          }),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: HOME_FAQ.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: item.answer,
              },
            })),
          },
        ]}
      />
      <a className="fo-skip" href="#contenido">
        {"Saltar al contenido"}
      </a>
      <LandingHeader />
      <main id="contenido">
        <section className="fo-hero fo-container" aria-labelledby="hero-title">
          <div className="fo-hero-copy">
            <p className="fo-eyebrow">
              <span aria-hidden="true" />
              {"PARA QUIENES VIVEN DE SU TALENTO"}
            </p>
            <h1 id="hero-title">
              {"Tu negocio, claro."}
              <br />
              <span>{"Tu tiempo, tuyo."}</span>
            </h1>
            <p className="fo-hero-description">
              {
                "Clientes, proyectos y finanzas en un solo lugar. Entiende lo que ganas con tu trabajo y enfócate en lo que sigue."
              }
            </p>
            <div className="fo-hero-ctas">
              <TrialLink source="hero" />
              <a
                href="#demo"
                className="fo-demo-link"
                onClick={() =>
                  trackEvent("hero_demo_open", {
                    path: "/",
                  })
                }
              >
                {"Explorar la demo "}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
            <p className="fo-trust">
              <Check size={15} aria-hidden="true" />
              {" Sin tarjeta "}
              <span>{"·"}</span>
              {" Sin instalaciones"} <span>{"·"}</span>
              {" Desde USD "}
              {startingPrice}
              {"/mes"}
            </p>
            <div className="fo-hero-foot">
              <span className="fo-small-monogram" aria-hidden="true">
                {"f."}
              </span>
              <p>
                {"Hecho para freelancers, consultores"}
                <br />
                {"y pequeñas agencias."}
              </p>
            </div>
          </div>
          <div className="fo-hero-visual">
            <div className="fo-preview-label">
              <span className="fo-small-label">{"MENOS PESTAÑAS. MÁS PERSPECTIVA."}</span>
              <span aria-hidden="true">{"↘"}</span>
            </div>
            <ProductPreview />
            <div className="fo-preview-below">
              <span aria-hidden="true">{"✦"}</span>
              {" Tu operación conectada, de principio a fin."}
            </div>
          </div>
        </section>
        <div className="fo-connection-strip">
          <div className="fo-container">
            <span>{"Todo lo que mueve tu negocio."}</span>
            <span>
              <FolderKanban size={17} />
              {"Proyectos"}
            </span>
            <span>
              <Clock3 size={17} />
              {"Horas"}
            </span>
            <span>
              <Wallet size={17} />
              {"Finanzas"}
            </span>
            <span>
              <CalendarDays size={17} />
              {"Planner"}
            </span>
            <span>
              <Sparkles size={17} />
              {"Asistente IA"}
            </span>
          </div>
        </div>
        <section id="producto" className="fo-section fo-container">
          <div className="fo-section-heading">
            <div>
              <p className="fo-eyebrow">{"EL TRABAJO YA ES SUFICIENTE TRABAJO"}</p>
              <h2>
                {"Que llevar tu negocio"}
                <br />
                {"no sea otro proyecto."}
              </h2>
            </div>
            <p>
              {
                "Tu información suele terminar repartida entre una hoja, una agenda y tu cabeza. Ferova One te ayuda a conectarla."
              }
            </p>
          </div>
          <div className="fo-benefits">
            <article className="fo-benefit fo-benefit-finance">
              <div className="fo-feature-icon">
                <Wallet size={23} />
              </div>
              <h3>
                {"Que facturar más"}
                <br />
                {"también tenga sentido."}
              </h3>
              <p>
                {
                  "Relaciona ingresos, costos y horas. Entiende qué cliente merece más de tu tiempo y qué servicio necesita un ajuste."
                }
              </p>
              <div className="fo-profit-example">
                <div>
                  <span>{"Proyecto de identidad"}</span>
                  <span>{"Ejemplo · COP"}</span>
                </div>
                <div>
                  <span>{"Ingreso registrado"}</span>
                  <b>{"$2.400.000"}</b>
                </div>
                <div>
                  <span>{"Costos registrados"}</span>
                  <b>{"$900.000"}</b>
                </div>
                <div className="fo-profit-total">
                  <span>{"Margen antes de otros gastos"}</span>
                  <b>{"$1.500.000"}</b>
                </div>
              </div>
              <Link to="/funciones/finanzas">
                {"Conocer las finanzas "}
                <ArrowUpRight size={16} />
              </Link>
            </article>
            <article className="fo-benefit">
              <div className="fo-feature-icon">
                <CalendarDays size={23} />
              </div>
              <h3>
                {"De mil pendientes"}
                <br />
                {"a un siguiente paso."}
              </h3>
              <p>
                {
                  "Reúne tus tareas, revisa prioridades y organiza tu agenda. Registra el tiempo que dedicas a cada cliente."
                }
              </p>
              <div className="fo-agenda-example" aria-label="Ejemplo de agenda">
                <span>{"09:00"}</span>
                <div>
                  <b>{"Identidad · Estudio Norte"}</b>
                  <small>{"Trabajo enfocado · 90 min"}</small>
                </div>
                <span>{"11:00"}</span>
                <div>
                  <b>{"Revisión con Casa Oliva"}</b>
                  <small>{"Reunión · 30 min"}</small>
                </div>
              </div>
              <Link to="/funciones/planner">
                {"Explorar el Planner "}
                <ArrowUpRight size={16} />
              </Link>
            </article>
            <article className="fo-benefit">
              <div className="fo-feature-icon">
                <FolderKanban size={23} />
              </div>
              <h3>
                {"El contexto completo."}
                <br />
                {"Sin volver a preguntar."}
              </h3>
              <p>
                {
                  "Clientes, objetivos, entregables y seguimiento juntos. Conecta tu operación con el CRM a partir del plan Intermedio."
                }
              </p>
              <div className="fo-client-example">
                <span className="fo-client-avatar">{"N"}</span>
                <div>
                  <b>{"Estudio Norte"}</b>
                  <small>{"Identidad de marca · ejemplo"}</small>
                </div>
                <span className="fo-tag">{"En marcha"}</span>
              </div>
              <div className="fo-client-checks">
                <span>
                  <Check size={15} />
                  {"Cliente y servicio"}
                </span>
                <span>
                  <Check size={15} />
                  {"Objetivos y entregables"}
                </span>
                <span>
                  <Check size={15} />
                  {"Horas e ingresos"}
                </span>
              </div>
              <Link to="/funciones">
                {"Ver todas las funciones "}
                <ArrowUpRight size={16} />
              </Link>
            </article>
          </div>
        </section>
        <section className="fo-ai-section">
          <div className="fo-container fo-ai-grid">
            <div>
              <p className="fo-eyebrow">{"UN POCO DE PERSPECTIVA EXTRA"}</p>
              <h2>
                {"Una segunda mirada."}
                <br />
                <span>{"Con el contexto de tu negocio."}</span>
              </h2>
              <p>
                {
                  "El asistente de Ferova One usa la información registrada para ayudarte a entender tus números y pensar el siguiente paso."
                }
              </p>
              <Link to="/funciones/asistente-ia" className="fo-text-link">
                {"Conocer el asistente "}
                <ArrowRight size={17} />
              </Link>
            </div>
            <div className="fo-ai-conversation">
              <div className="fo-ai-person">
                <span className="fo-avatar">{"Tú"}</span>
                <p>{"¿En qué debería enfocarme hoy?"}</p>
              </div>
              <div className="fo-ai-answer">
                <img src="/brand/ferova-isotipo.png" width="24" height="30" alt="" loading="lazy" />
                <div>
                  <b>{"Empecemos por lo que tienes pendiente."}</b>
                  <p>
                    {
                      "Revisa tus cobros, las tareas prioritarias y el avance de tus proyectos. Con tus registros, podemos poner esas decisiones en contexto."
                    }
                  </p>
                </div>
              </div>
              <p className="fo-example-disclaimer">
                {
                  "Conversación ilustrativa. Revisa las respuestas y las cifras antes de tomar decisiones."
                }
              </p>
            </div>
          </div>
        </section>
        <section id="como-funciona" className="fo-section fo-container">
          <div className="fo-section-heading">
            <div>
              <p className="fo-eyebrow">{"EMPIEZA PEQUEÑO. GANA CLARIDAD."}</p>
              <h2>
                {"No tienes que organizarlo"}
                <br />
                {"todo el primer día."}
              </h2>
            </div>
            <p>
              {
                "Un cliente, un servicio y tu primer registro. Después, construye el hábito a tu ritmo."
              }
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
            <TrialLink source="how_it_works">{"Elegir mi plan de prueba"}</TrialLink>
          </div>
        </section>
        <section id="precios" className="fo-pricing-section">
          <div className="fo-container">
            <div className="fo-heading-centered">
              <p className="fo-eyebrow">{"UN PLAN PARA TU MOMENTO"}</p>
              <h2>
                {"Empieza por claridad."}
                <br />
                {"Crece a tu ritmo."}
              </h2>
              <p>
                {"Elige según los clientes que atiendes y las herramientas que necesitas."}
                <br />
                {"Pruébalo "}
                {TRIAL_DAYS}
                {" días sin tarjeta."}
              </p>
            </div>
            <LandingPricing />
          </div>
        </section>
        <section id="preguntas" className="fo-section fo-container fo-faq">
          <div>
            <p className="fo-eyebrow">{"ANTES DE EMPEZAR"}</p>
            <h2>
              {"Las cosas claras,"}
              <br />
              {"desde aquí."}
            </h2>
            <p>{"Sin letras pequeñas sobre tu prueba."}</p>
            <Link to="/seguridad" className="fo-text-link">
              <ShieldCheck size={17} />
              {" Cómo cuidamos tus datos"}
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
            <p className="fo-eyebrow">{"HAZLE ESPACIO A LO QUE SIGUE"}</p>
            <h2>
              {"Menos administrar."}
              <br />
              <span>{"Más hacer lo tuyo."}</span>
            </h2>
            <p>{"Tu trabajo merece un negocio que lo acompañe."}</p>
            <TrialLink source="footer" className="fo-button-light" />
            <p className="fo-final-note">
              {TRIAL_DAYS}
              {" días gratis · Sin tarjeta · Tú decides si continúas"}
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
              {"Tu talento mueve el negocio."}
              <br />
              {"Ferova One te ayuda a llevarlo."}
            </p>
          </div>
          <nav aria-label="Producto">
            <b>{"Producto"}</b>
            <Link to="/funciones/finanzas">{"Finanzas"}</Link>
            <Link to="/funciones/planner">{"Planner"}</Link>
            <Link to="/funciones/crm">{"CRM"}</Link>
            <Link to="/precios">{"Planes y precios"}</Link>
          </nav>
          <nav aria-label="Recursos">
            <b>{"Recursos"}</b>
            <Link to="/blog">{"Guías para tu negocio"}</Link>
            <Link to="/blog/cliente-rentable">{"Rentabilidad por cliente"}</Link>
            <Link to="/novedades">{"Novedades"}</Link>
            <Link to="/seguridad">{"Seguridad"}</Link>
          </nav>
          <nav aria-label="Legal">
            <b>{"Legal"}</b>
            <Link to="/privacidad">{"Privacidad"}</Link>
            <Link to="/terminos">{"Términos"}</Link>
            <Link to="/reembolsos">{"Reembolsos"}</Link>
            <Link to="/subencargados">{"Subencargados"}</Link>
          </nav>
        </div>
        <div className="fo-footer-bottom">
          <span>
            {"© "}
            {new Date().getFullYear()}
            {" Ferova One · Un producto de Ferova."}
          </span>
          <span>{"Hecho para trabajar con claridad."}</span>
        </div>
      </footer>
    </div>
  );
}
export { Landing as default };

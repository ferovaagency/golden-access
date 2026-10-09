import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { getPlanCatalog, TRIAL_DAYS, type PaidTier, type Periodo } from "../../lib/planService";
import { planIntentPath } from "../../lib/planIntent";
import { trackEvent } from "../../lib/analytics";

const details: Record<PaidTier, { description: string; features: string[] }> = {
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

export function LandingPricing() {
  const [period, setPeriod] = useState<Periodo>("mensual");
  const sectionRef = useRef<HTMLDivElement>(null);
  const plans = getPlanCatalog();
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEvent("pricing_view", { path: "/", source: "landing_redesign" });
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
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
          Mensual
        </button>
        <button type="button" aria-pressed={period === "anual"} onClick={() => setPeriod("anual")}>
          Anual <span>Hasta {Math.max(...plans.map((p) => p.ahorroAnualPct))}% menos</span>
        </button>
      </div>
      <div className="fo-pricing-grid">
        {plans.map((plan) => (
          <article key={plan.id} className={`fo-plan ${plan.destacado ? "fo-plan-featured" : ""}`}>
            <div className="fo-plan-top">
              <span>{plan.etiqueta}</span>
              {plan.destacado && <b>Para crecer</b>}
            </div>
            <h3>{plan.nombre}</h3>
            <p>{details[plan.id].description}</p>
            <div className="fo-price">
              <span>USD</span>
              <strong>{period === "anual" ? plan.precioAnualMes : plan.precioMensual}</strong>
              <span>/ mes</span>
            </div>
            <p className="fo-billing-detail">
              {period === "anual"
                ? `USD ${plan.precioAnualTotal} al año · ahorro de ${plan.ahorroAnualPct}%.`
                : "Facturación mensual."}
              <br />
              Después de tus {TRIAL_DAYS} días de prueba.
            </p>
            <Link
              className={`fo-button ${plan.destacado ? "fo-button-primary" : "fo-button-outline"}`}
              to={planIntentPath({ plan: plan.id, periodo: period })}
              onClick={() =>
                trackEvent("pricing_cta", {
                  path: "/",
                  plan: plan.id,
                  periodo: period,
                  source: "landing_redesign",
                })
              }
            >
              Probar {plan.nombre}
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
        Todos los planes incluyen {TRIAL_DAYS} días gratis, sin tarjeta. Precios en USD antes de
        impuestos.
        <br />
        Si no añades un método de pago, la prueba termina sin un cobro automático.{" "}
        <Link to="/precios">
          Ver detalles de los planes <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}

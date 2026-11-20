import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { FREE_PLAN_SUMMARY, getPlanCatalog, type PaidTier, type Periodo } from "../../lib/planService";
import { planIntentPath } from "../../lib/planIntent";
import { trackEvent } from "../../lib/analytics";

const details: Record<PaidTier, { description: string; features: string[] }> = {
  medio: {
    description: "Controla todo tu negocio: caja, cobros, impuestos y cuánto te deja cada cliente.",
    features: [
      "Hasta 10 clientes activos",
      "Finanzas completas: caja, cuentas por cobrar y por pagar",
      "Impuestos: IVA, alertas DIAN y UVT",
      "Rentabilidad por cliente y por servicio",
      "Google Calendar y Google Sheets",
      "150 consultas de IA al mes · 2 usuarios",
    ],
  },
  pro: {
    description: "Vende y crece con equipo: CRM, WhatsApp, varias empresas y reportes ejecutivos.",
    features: [
      "Clientes ilimitados",
      "Todo lo incluido en Medio",
      "CRM, pipeline y citas",
      "Marketing ROI, WhatsApp y Apollo",
      "Varias empresas y reportes CEO",
      "1.000 consultas de IA al mes · 5 usuarios",
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
        <article className="fo-plan">
          <div className="fo-plan-top">
            <span>{FREE_PLAN_SUMMARY.etiqueta}</span>
          </div>
          <h3>{FREE_PLAN_SUMMARY.nombre}</h3>
          <p>{FREE_PLAN_SUMMARY.promesa}</p>
          <div className="fo-price">
            <span>USD</span>
            <strong>0</strong>
            <span>/ mes</span>
          </div>
          <p className="fo-billing-detail">
            Sin tarjeta y sin fecha de vencimiento.
            <br />
            Subes de plan cuando lo necesites.
          </p>
          <Link
            className="fo-button fo-button-outline"
            to="/app"
            onClick={() => trackEvent("pricing_cta", { path: "/", plan: "free", periodo: period, source: "landing_redesign" })}
          >
            Empezar gratis
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <ul>
            {FREE_PLAN_SUMMARY.incluye.map((feature) => (
              <li key={feature}>
                <Check size={16} aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
        </article>
        {plans.map((plan) => (
          <article key={plan.id} className={`fo-plan ${plan.destacado ? "fo-plan-featured" : ""}`}>
            <div className="fo-plan-top">
              <span>{plan.etiqueta}</span>
              {plan.destacado && <b>Recomendado</b>}
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
              Cancelas cuando quieras.
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
              Elegir {plan.nombre}
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
        Empiezas gratis, sin tarjeta. Precios en USD antes de impuestos; el pago se procesa con
        Whop.
        <br />
        Si cancelas un plan de pago, tu cuenta vuelve al plan Gratis con todos tus datos.{" "}
        <Link to="/precios">
          Ver detalles de los planes <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}

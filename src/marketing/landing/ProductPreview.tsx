import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  LayoutDashboard,
  Wallet,
  FolderKanban,
} from "lucide-react";
import { trackEvent } from "../../lib/analytics";

const demoViews = [
  { id: "hoy", label: "Mi día", icon: LayoutDashboard },
  { id: "finanzas", label: "Mi dinero", icon: Wallet },
  { id: "proyectos", label: "Mis proyectos", icon: FolderKanban },
] as const;

export function ProductPreview() {
  const [view, setView] = useState<(typeof demoViews)[number]["id"]>("hoy");
  const [done, setDone] = useState(false);
  return (
    <div className="fo-preview" id="demo">
      <div className="fo-preview-top">
        <span className="fo-preview-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>Tu espacio de trabajo</span>
        <span className="fo-live-dot">Vista de ejemplo</span>
      </div>
      <div className="fo-preview-body">
        <div className="fo-demo-nav" role="group" aria-label="Explorar demostración">
          {demoViews.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => {
                setView(id);
                trackEvent("module_demo_interaction", { module: id, source: "home_preview" });
              }}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <div className="fo-demo-content" aria-live="polite">
          <div className="fo-demo-heading">
            <div>
              <span className="fo-small-label">ESTUDIO CREATIVO · EJEMPLO</span>
              <h2>
                {view === "hoy"
                  ? "Hoy, enfócate en avanzar."
                  : view === "finanzas"
                    ? "Tus números, sin vueltas."
                    : "Todo tiene su lugar."}
              </h2>
            </div>
            <span className="fo-avatar" aria-hidden="true">
              E
            </span>
          </div>
          <div className="fo-demo-metrics">
            <div>
              <span>Ingresos del mes</span>
              <strong>$8.400.000</strong>
              <small>COP · ventas registradas</small>
            </div>
            <div>
              <span>Por cobrar</span>
              <strong>$2.100.000</strong>
              <small>2 cobros pendientes</small>
            </div>
            <div>
              <span>Horas registradas</span>
              <strong>
                64 <em>h</em>
              </strong>
              <small>En tus proyectos</small>
            </div>
          </div>
          {view === "hoy" && (
            <>
              <div className="fo-demo-section-label">
                <h3>Tu siguiente paso</h3>
                <span>{done ? "2 de 3 pendientes" : "3 pendientes"}</span>
              </div>
              <button
                type="button"
                className={`fo-task ${done ? "is-done" : ""}`}
                aria-pressed={done}
                onClick={() => {
                  setDone(!done);
                  trackEvent("module_demo_interaction", { module: "complete_demo_task" });
                }}
              >
                <span className="fo-check-circle">
                  {done ? <Check size={14} /> : <Circle size={16} />}
                </span>
                <span>
                  <b>Enviar propuesta a Estudio Norte</b>
                  <small>Proyecto de identidad · 30 min</small>
                </span>
                <span className="fo-tag">{done ? "Listo" : "Prioridad"}</span>
              </button>
              <div className="fo-task">
                <span className="fo-check-circle">
                  <Circle size={16} />
                </span>
                <span>
                  <b>Revisar el cobro de Casa Oliva</b>
                  <small>Saldo pendiente · $1.200.000</small>
                </span>
                <ChevronRight size={16} />
              </div>
              <div className="fo-task">
                <span className="fo-check-circle">
                  <Circle size={16} />
                </span>
                <span>
                  <b>Diseñar la primera propuesta</b>
                  <small>Estudio Norte · bloque de 90 min</small>
                </span>
                <Clock3 size={16} />
              </div>
              <div className="fo-demo-note">
                <span className="fo-note-star" aria-hidden="true">
                  ✦
                </span>
                <p>
                  Menos pendientes en tu cabeza.
                  <br />
                  <b>Más claridad para tu siguiente paso.</b>
                </p>
              </div>
            </>
          )}
          {view === "finanzas" && (
            <>
              <div className="fo-demo-section-label">
                <h3>Ingresos y costos registrados</h3>
                <span>Ejemplo · COP</span>
              </div>
              <div
                className="fo-chart"
                role="img"
                aria-label="Ejemplo: ingresos crecen de enero a junio; los costos son menores que los ingresos."
              >
                {[40, 54, 47, 72, 62, 90].map((h, i) => (
                  <div key={i}>
                    <span>
                      <i style={{ height: `${h}%` }} />
                      <i style={{ height: `${h * 0.52}%` }} />
                    </span>
                    <small>{["Ene", "Feb", "Mar", "Abr", "May", "Jun"][i]}</small>
                  </div>
                ))}
              </div>
              <div className="fo-chart-key">
                <span>● Ingresos</span>
                <span>● Costos</span>
              </div>
              <p className="fo-demo-footnote">
                Cruza lo que cobras, lo que gastas y el tiempo que dedicas.
              </p>
            </>
          )}
          {view === "proyectos" && (
            <>
              <div className="fo-demo-section-label">
                <h3>Proyectos en marcha</h3>
                <span>2 activos</span>
              </div>
              {[
                { name: "Estudio Norte", work: "Identidad de marca", progress: 65 },
                { name: "Casa Oliva", work: "Sitio web", progress: 40 },
              ].map((p) => (
                <div className="fo-demo-project" key={p.name}>
                  <span>
                    <b>{p.name}</b>
                    <small>{p.work}</small>
                  </span>
                  <span>{p.progress}%</span>
                  <div className="fo-progress">
                    <i style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
              ))}
              <div className="fo-demo-note">
                <FolderKanban size={20} />
                <p>
                  Cliente, objetivos y entregables.
                  <br />
                  <b>El contexto completo, en un lugar.</b>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="fo-preview-caption">
        <span>Demostración interactiva · datos ficticios</span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </div>
    </div>
  );
}

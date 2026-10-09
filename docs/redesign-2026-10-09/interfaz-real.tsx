import { useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  Home as HomeIcon,
  FolderKanban,
  Wallet,
  TrendingUp,
  Settings,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { AppData } from "../../src/types";
import type { NavigationSection } from "../../src/components/layout/navigationTypes";
import { AppShell } from "../../src/components/layout/AppShell";
import { ToastProvider } from "../../src/components/ui/toast";
import Home from "../../src/components/Home";
import ClientesAdmin from "../../src/components/ClientesAdmin";
import ServiciosAdmin from "../../src/components/ServiciosAdmin";
import HorasAdmin from "../../src/components/HorasAdmin";
import ProyectosAdmin from "../../src/components/ProyectosAdmin";
import VentasAdmin from "../../src/components/VentasAdmin";
import EquilibrioGlobal from "../../src/components/EquilibrioGlobal";
import EquilibrioServicio from "../../src/components/EquilibrioServicio";
import ImpuestosIva from "../../src/components/ImpuestosIva";
import AlertasTributarias from "../../src/components/AlertasTributarias";
import { calcularMétricasFinancieras } from "../../src/lib/calculations";
import { fixture } from "./fixtures";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "../../src/index.css";
import "./interfaz-real.css";

// Exact current tab IDs/labels from App.tsx. This fixture represents an owner on Full.
const item = (id: string, label: string, hint: string) => ({ id, label, hint });
const sections: NavigationSection[] = [
  {
    id: "home",
    label: "Inicio",
    icon: HomeIcon,
    items: [item("dashboard", "Resumen", "Salud, prioridades y actividad")],
  },
  {
    id: "projects",
    label: "Proyectos",
    icon: FolderKanban,
    items: [
      item("clientes", "Clientes", "Cuentas activas"),
      item("servicios", "Servicios", "Catálogo y costos"),
      item("horas", "Horas", "Capacidad y rentabilidad"),
      item("proyectos", "Proyectos", "Plan y seguimiento por cliente"),
      item("planner", "Planner", "Prioridades, agenda y bloques"),
    ],
  },
  {
    id: "finance",
    label: "Finanzas",
    icon: Wallet,
    items: [
      item("reports", "Reportes CEO", "Seguimiento ejecutivo"),
      ...[
        ["finops", "Finanzas operativas", "Cuentas, deudas, flujo"],
        ["ventas", "Ingresos", "Ventas y abonos"],
        ["pagosEgresos", "Pagos", "Egresos registrados"],
        ["gastos", "Costos", "Herramientas y gastos"],
        ["equilibrioGlobal", "Equilibrio", "Punto global"],
        ["equilibrioServicio", "Por servicio", "Margen unitario"],
        ["iva", "IVA", "Control tributario"],
        ["alertas", "Alertas", "Riesgos y topes"],
        ["kpisOperativos", "Seguimiento", "Metas de MRR, prospección y pasarelas"],
      ].map(([id, label, hint]) => ({ ...item(id, label, hint), group: "Finanzas" as const })),
    ],
  },
  {
    id: "sales",
    label: "Ventas",
    icon: TrendingUp,
    items: [
      item("ventas-crm", "CRM", "Pipeline y oportunidades"),
      item("marketingRoi", "Marketing ROI", "Campañas y calculadora"),
      item("crm-citas", "Citas", "Diagnósticos y Calendar"),
      item("crm-bot", "Bot WhatsApp", "Conocimiento y estado"),
    ],
  },
  {
    id: "settings",
    label: "Configuración",
    icon: Settings,
    items: [
      item("plan", "Mi plan", "Suscripción, prueba y tarjeta"),
      item("integraciones", "Integraciones", "Google, WhatsApp, Apollo"),
      item("ajustes", "Configuración", "Datos y Google Sheets"),
      item("memoria", "Memoria", "Contexto del negocio"),
    ],
  },
];
const user = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "demo@ferova.example",
  app_metadata: {},
  user_metadata: { full_name: "Estudio de ejemplo" },
  aud: "authenticated",
  created_at: "2026-10-01",
} as User;
const cop = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
const allItems = sections.flatMap((s) => s.items);
const implemented = new Set([
  "dashboard",
  "clientes",
  "servicios",
  "horas",
  "proyectos",
  "ventas",
  "equilibrioGlobal",
  "equilibrioServicio",
  "iva",
  "alertas",
]);
function Preview() {
  const [data, setData] = useState<AppData>(() => structuredClone(fixture));
  const [tab, setTab] = useState("dashboard");
  const [look, setLook] = useState("proposed");
  const [mobile, setMobile] = useState(false);
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-31");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState(
    "Datos ficticios · Los cambios se conservan solo mientras esta vista esté abierta.",
  );
  const search = useRef<HTMLDialogElement>(null);
  const assistant = useRef<HTMLDialogElement>(null);
  const period = { from, to };
  const metrics = calcularMétricasFinancieras(data, period);
  const activeSection = sections.find((s) => s.items.some((i) => i.id === tab))!;
  const navigate = (id: string) => {
    setTab(id);
    setMobile(false);
    search.current?.close();
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.current?.showModal();
      }
      if (e.key === "Escape") setMobile(false);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const save =
    <K extends keyof AppData>(key: K) =>
    async (value: AppData[K]) => {
      setData((d) => ({ ...d, [key]: value }));
      setNotice("Cambio aplicado al ejemplo. No se ha enviado ningún dato a tu cuenta.");
    };
  let content: ReactNode;
  switch (tab) {
    case "dashboard":
      content = (
        <Home data={data} metrics={metrics} period={period} formatCop={cop} onNavigate={navigate} />
      );
      break;
    case "clientes":
      content = (
        <ClientesAdmin
          clientes={data.clientes}
          ventas={data.ventas}
          horas={data.horas}
          config={data.config}
          onSaveClientes={save("clientes")}
          formatCop={cop}
          formatUsd={usd}
        />
      );
      break;
    case "servicios":
      content = (
        <ServiciosAdmin
          servicios={data.servicios}
          ventas={data.ventas}
          horas={data.horas}
          config={data.config}
          onSaveServicios={save("servicios")}
          formatCop={cop}
        />
      );
      break;
    case "horas":
      content = (
        <HorasAdmin
          horas={data.horas}
          clientes={data.clientes}
          servicios={data.servicios}
          ventas={data.ventas}
          config={data.config}
          metrics={metrics}
          period={period}
          onSaveHoras={save("horas")}
          onSaveConfig={async (update) => {
            setData((current) => ({ ...current, config: { ...current.config, ...update } }));
            setNotice("Configuración del ejemplo actualizada. Tu cuenta no se ha modificado.");
          }}
          formatCop={cop}
        />
      );
      break;
    case "proyectos":
      content = <ProyectosAdmin projectData={data} onSaveClientes={save("clientes")} />;
      break;
    case "ventas":
      content = (
        <VentasAdmin
          userId={user.id}
          ventas={data.ventas}
          clientes={data.clientes}
          servicios={data.servicios}
          config={data.config}
          period={period}
          onSaveVentas={save("ventas")}
          formatCop={cop}
          formatUsd={usd}
        />
      );
      break;
    case "equilibrioGlobal":
      content = <EquilibrioGlobal metrics={metrics} formatCop={cop} />;
      break;
    case "equilibrioServicio":
      content = (
        <EquilibrioServicio
          servicios={data.servicios}
          herramientas={data.herramientas}
          clientes={data.clientes}
          ventas={data.ventas}
          config={data.config}
          period={period}
          formatCop={cop}
        />
      );
      break;
    case "iva":
      content = <ImpuestosIva data={data} metrics={metrics} formatCop={cop} />;
      break;
    case "alertas":
      content = (
        <AlertasTributarias
          metrics={metrics}
          config={data.config}
          ventas={data.ventas}
          formatCop={cop}
        />
      );
      break;
    default:
      content = (
        <section className="preserved-module">
          <span>SECCIÓN CONSERVADA</span>
          <h1>{allItems.find((i) => i.id === tab)?.label}</h1>
          <p>
            Esta propuesta mantiene el módulo y su ubicación. Su contenido conectado no se simula en
            esta vista offline.
          </p>
          <p>
            Puedes explorar con componentes reales: Resumen, Clientes, Servicios, Horas, Proyectos,
            Ingresos, Equilibrio, Por servicio, IVA y Alertas.
          </p>
          <button onClick={() => navigate("dashboard")}>Volver al resumen</button>
        </section>
      );
  }
  return (
    <div className="real-preview" data-look={look}>
      <aside className="preview-reviewbar" aria-label="Revisión de propuesta">
        <div>
          <strong>Propuesta de interfaz</strong>
          <span>Componentes reales · Sin conexión a tu cuenta</span>
        </div>
        <div role="group" aria-label="Comparar apariencia">
          <button aria-pressed={look === "current"} onClick={() => setLook("current")}>
            Aspecto actual
          </button>
          <button aria-pressed={look === "proposed"} onClick={() => setLook("proposed")}>
            Propuesta azul / blanco
          </button>
        </div>
      </aside>
      <AppShell
        sections={sections}
        activeSectionId={activeSection.id}
        activeTab={tab}
        onNavigateTab={navigate}
        user={user}
        onSignOut={() => setNotice("Vista de ejemplo: no hay una sesión real que cerrar.")}
        mobileMenuOpen={mobile}
        onToggleMobileMenu={() => setMobile(!mobile)}
        onCloseMobileMenu={() => setMobile(false)}
        topBar={
          <header className="proposal-topbar">
            <div>
              <strong>Estudio de ejemplo</strong>
              <span>Mi espacio de trabajo · Full</span>
            </div>
            <div>
              <button onClick={() => search.current?.showModal()} aria-label="Buscar módulo">
                <Search size={17} />
                <span>Buscar</span>
                <kbd>Ctrl K</kbd>
              </button>
              <button onClick={() => assistant.current?.showModal()}>
                <Sparkles size={17} />
                Asistente
              </button>
            </div>
          </header>
        }
        periodBar={
          <div className="proposal-period">
            <div>
              <label>
                Desde
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => e.target.value && setFrom(e.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => e.target.value && setTo(e.target.value)}
                />
              </label>
            </div>
            <label>
              TRM del ejemplo
              <input
                aria-label="TRM del ejemplo"
                type="number"
                min="1"
                value={data.config.trm}
                onChange={(e) => {
                  const trm = Number(e.target.value);
                  if (trm > 0) setData((d) => ({ ...d, config: { ...d.config, trm } }));
                }}
              />
            </label>
          </div>
        }
        footer={
          <footer className="proposal-footer">
            Ferova One · Propuesta local con datos ficticios. Los permisos, integraciones y planes
            del producto no se han modificado.
          </footer>
        }
      >
        <p className="demo-notice" role="status">
          {notice}
        </p>
        <div className="module-host" data-module={tab}>
          {content}
        </div>
      </AppShell>
      <dialog ref={search} className="proposal-dialog" aria-labelledby="search-title">
        <header>
          <h2 id="search-title">Buscar módulo</h2>
          <button onClick={() => search.current?.close()} aria-label="Cerrar búsqueda">
            <X />
          </button>
        </header>
        <label>
          Nombre de la sección
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ingresos, clientes, planner…"
          />
        </label>
        <div className="preview-search-results">
          {allItems
            .filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
            .map((i) => (
              <button key={i.id} onClick={() => navigate(i.id)}>
                {i.label}
                <small>
                  {implemented.has(i.id)
                    ? "Vista con componente real"
                    : "Se conserva en la aplicación"}
                </small>
              </button>
            ))}
        </div>
      </dialog>
      <dialog
        ref={assistant}
        className="proposal-dialog assistant-dialog"
        aria-labelledby="ai-title"
      >
        <header>
          <h2 id="ai-title">Asistente Ferova</h2>
          <button onClick={() => assistant.current?.close()} aria-label="Cerrar asistente">
            <X />
          </button>
        </header>
        <p>Contexto: {activeSection.label}</p>
        <div className="ai-example">
          <strong>¿Qué debería revisar primero?</strong>
          <p>
            En este ejemplo puedes revisar los cobros pendientes y el avance de los proyectos. En la
            aplicación, el asistente mantendría sus herramientas y permisos actuales.
          </p>
        </div>
        <small>Texto ilustrativo. No hay una llamada a IA en esta propuesta.</small>
      </dialog>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <Preview />
  </ToastProvider>,
);

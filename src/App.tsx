import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  Building2,
  User as UserIcon,
  LogOut,
  Database,
  Calendar,
  Loader2,
  AlertCircle,
  Menu,
  X,
} from 'lucide-react';

import {
  supabase,
  onAuthStateChange,
  getCurrentSession,
  getStoredProviderToken,
  signOut,
  hasActiveSubscription,
} from './lib/supabase';

import {
  findSpreadsheet,
  createSpreadsheet,
  fetchSpreadsheetData,
  saveSheetTable,
  updateConfigInSheet,
  createDriveBackup,
  restoreFromBackup,
  searchAllRelatedSpreadsheets,
  untrashSpreadsheet,
  DriveFileInfo,
} from './lib/sheetsService';
import {
  Config,
  AppData,
  Cliente,
  Servicio,
  Herramienta,
  OtroGasto,
  Venta,
  Hora,
  Respaldo,
  PagoEgreso,
} from './types';
import {
  calcularMétricasFinancieras,
  getUniqueSalesMonths,
} from './lib/calculations';

import AuthScreen from './components/AuthScreen';
import Paywall from './components/Paywall';
import ConnectGoogleScreen from './components/ConnectGoogleScreen';

import Dashboard from './components/Dashboard';
import ClientesAdmin from './components/ClientesAdmin';
import ServiciosAdmin from './components/ServiciosAdmin';
import VentasAdmin from './components/VentasAdmin';
import HorasAdmin from './components/HorasAdmin';
import GastosAdmin from './components/GastosAdmin';
import EquilibrioGlobal from './components/EquilibrioGlobal';
import EquilibrioServicio from './components/EquilibrioServicio';
import ImpuestosIva from './components/ImpuestosIva';
import AlertasTributarias from './components/AlertasTributarias';
import ConfigAdmin from './components/ConfigAdmin';
import ProyectosAdmin from './components/ProyectosAdmin';
import PagosEgresosAdmin from './components/PagosEgresosAdmin';

type AppStage =
  | 'loading'
  | 'unauthenticated'
  | 'needs_payment'
  | 'needs_google'
  | 'booting_sheets'
  | 'ready';

export default function App() {
  // --- Auth + paywall state -----------------------------------------------
  const [session, setSession] = useState<Session | null>(null);
  const [providerToken, setProviderToken] = useState<string | null>(null);
  const [hasPaid, setHasPaid] = useState(false);
  const [stage, setStage] = useState<AppStage>('loading');
  const [stageError, setStageError] = useState<string | null>(null);

  const user: User | null = session?.user ?? null;

  // --- Sheet/app data state (preservada del App original) ------------------
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetLink, setSpreadsheetLink] = useState<string | null>(null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [relatedSheets, setRelatedSheets] = useState<DriveFileInfo[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [headerTrm, setHeaderTrm] = useState<string>('');
  const [isEditingTrm, setIsEditingTrm] = useState(false);

  useEffect(() => {
    if (appData?.config?.trm) setHeaderTrm(String(appData.config.trm));
  }, [appData?.config?.trm]);

  // --- Recompute stage based on auth + payment + token --------------------
  const recomputeStage = useCallback(
    async (
      nextSession: Session | null,
      nextProviderToken: string | null
    ) => {
      setStageError(null);
      if (!nextSession?.user) {
        setHasPaid(false);
        setStage('unauthenticated');
        return;
      }
      try {
        const paid = await hasActiveSubscription(nextSession.user.id);
        setHasPaid(paid);
        if (!paid) {
          setStage('needs_payment');
          return;
        }
        if (!nextProviderToken) {
          setStage('needs_google');
          return;
        }
        setStage('ready');
      } catch (err: any) {
        console.error('[Ferova] error en recomputeStage:', err);
        setStageError(err?.message ?? 'Error verificando tu cuenta.');
        setStage('needs_payment');
      }
    },
    []
  );

  // --- Initial session + auth listener ------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      const current = await getCurrentSession();
      if (!mounted) return;
      const token = current?.provider_token ?? getStoredProviderToken();
      setSession(current);
      setProviderToken(token);
      await recomputeStage(current, token);
    })();

    const subscription = onAuthStateChange((change) => {
      setSession(change.session);
      setProviderToken(change.providerToken);
      void recomputeStage(change.session, change.providerToken);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [recomputeStage]);

  // --- Bootstrap sheets when ready ----------------------------------------
  const bootstrapSheets = useCallback(
    async (token: string) => {
      setStage('booting_sheets');
      setSheetsLoading(true);
      setErrorMsg(null);
      try {
        const existing = await findSpreadsheet(token);
        const id = existing?.id ?? (await createSpreadsheet(token));
        setSpreadsheetId(id);
        setSpreadsheetLink(
          existing?.webViewLink ??
            `https://docs.google.com/spreadsheets/d/${id}/edit`
        );
        const data = await fetchSpreadsheetData(id, token);
        setAppData(data);
        setStage('ready');
      } catch (err: any) {
        console.error('[Ferova] bootstrapSheets:', err);
        setErrorMsg(
          err?.message ??
            'No se pudo cargar tu spreadsheet de Google. Reconecta Google.'
        );
        // Si el token está vencido vuelve a needs_google
        setProviderToken(null);
        setStage('needs_google');
      } finally {
        setSheetsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (
      stage === 'ready' &&
      providerToken &&
      !appData &&
      !sheetsLoading
    ) {
      void bootstrapSheets(providerToken);
    }
  }, [stage, providerToken, appData, sheetsLoading, bootstrapSheets]);

  // --- Helpers expuestos a los hijos --------------------------------------
  const handleSignOut = async () => {
    await signOut();
    setAppData(null);
    setSpreadsheetId(null);
    setSpreadsheetLink(null);
  };

  const handleRefresh = useCallback(async () => {
    if (!spreadsheetId || !providerToken) return;
    setSheetsLoading(true);
    try {
      const data = await fetchSpreadsheetData(spreadsheetId, providerToken);
      setAppData(data);
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Error al refrescar datos.');
    } finally {
      setSheetsLoading(false);
    }
  }, [spreadsheetId, providerToken]);

  const handlePaid = useCallback(async () => {
    if (!session) return;
    await recomputeStage(session, providerToken);
  }, [session, providerToken, recomputeStage]);

  const metrics = useMemo(() => {
    if (!appData) return null;
    try {
      return calcularMétricasFinancieras(appData, selectedMonth);
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [appData, selectedMonth]);

  const months = useMemo(
    () => (appData ? getUniqueSalesMonths(appData.ventas ?? []) : []),
    [appData]
  );

  // --- RENDER PER STAGE ---------------------------------------------------

  if (stage === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#0f0e0c' }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#c9a961' }} />
      </div>
    );
  }

  if (stage === 'unauthenticated') {
    return <AuthScreen />;
  }

  if (stage === 'needs_payment' && user) {
    return (
      <>
        {stageError && (
          <div
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 p-3 rounded-lg text-xs"
            style={{
              backgroundColor: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5',
            }}
          >
            {stageError}
          </div>
        )}
        <Paywall user={user} onPaid={handlePaid} />
      </>
    );
  }

  if (stage === 'needs_google' && user) {
    return <ConnectGoogleScreen user={user} />;
  }

  if (stage === 'booting_sheets' || (stage === 'ready' && !appData)) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: '#0f0e0c' }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#c9a961' }} />
        <p className="text-sm text-zinc-400">Cargando tu workspace…</p>
        {errorMsg && (
          <div
            className="max-w-md p-3 rounded-lg text-xs flex items-start gap-2"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#fca5a5',
            }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    );
  }

  // --- READY: Render dashboard de Ferova OS -------------------------------
  if (stage === 'ready' && appData && user && spreadsheetId && providerToken) {
    return (
      <ReadyShell
        user={user}
        appData={appData}
        setAppData={setAppData}
        spreadsheetId={spreadsheetId}
        spreadsheetLink={spreadsheetLink}
        providerToken={providerToken}
        metrics={metrics}
        months={months}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        sheetsLoading={sheetsLoading}
        setSheetsLoading={setSheetsLoading}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
        headerTrm={headerTrm}
        setHeaderTrm={setHeaderTrm}
        isEditingTrm={isEditingTrm}
        setIsEditingTrm={setIsEditingTrm}
        onSignOut={handleSignOut}
        onRefresh={handleRefresh}
      />
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
//  ReadyShell — UI principal (header + tabs + admins).
//  Mantiene la lógica original simple para que VentasAdmin, Dashboard, etc.
//  sigan recibiendo las mismas props que esperan.
// ---------------------------------------------------------------------------

interface ReadyShellProps {
  user: User;
  appData: AppData;
  setAppData: React.Dispatch<React.SetStateAction<AppData | null>>;
  spreadsheetId: string;
  spreadsheetLink: string | null;
  providerToken: string;
  metrics: ReturnType<typeof calcularMétricasFinancieras> | null;
  months: string[];
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  activeTab: string;
  setActiveTab: (t: string) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (v: boolean) => void;
  sheetsLoading: boolean;
  setSheetsLoading: (v: boolean) => void;
  errorMsg: string | null;
  setErrorMsg: (v: string | null) => void;
  headerTrm: string;
  setHeaderTrm: (v: string) => void;
  isEditingTrm: boolean;
  setIsEditingTrm: (v: boolean) => void;
  onSignOut: () => void;
  onRefresh: () => void;
}

const TABS: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'horas', label: 'Horas' },
  { id: 'gastos', label: 'Gastos' },
  { id: 'pagos', label: 'Pagos egresos' },
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'equilibrio', label: 'Equilibrio' },
  { id: 'equilibrioServicio', label: 'Eq. por servicio' },
  { id: 'iva', label: 'IVA' },
  { id: 'alertas', label: 'Alertas' },
  { id: 'config', label: 'Configuración' },
];

function ReadyShell(p: ReadyShellProps) {
  const persist = async <K extends keyof AppData>(key: K, value: AppData[K]) => {
    p.setAppData((prev) => (prev ? { ...prev, [key]: value } : prev));
    try {
      await saveSheetTable(
        p.spreadsheetId,
        p.providerToken,
        String(key),
        value as any
      );
    } catch (err: any) {
      console.error(`[Ferova] error guardando ${String(key)}:`, err);
      p.setErrorMsg(err?.message ?? `Error guardando ${String(key)}`);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#0f0e0c', color: 'white' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: '#1a1814',
          borderBottom: '1px solid #2a2620',
        }}
      >
        <div className="flex items-center gap-2">
          <button
            className="md:hidden p-1"
            onClick={() => p.setIsMobileMenuOpen(!p.isMobileMenuOpen)}
          >
            {p.isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
          <Building2 className="w-5 h-5" style={{ color: '#c9a961' }} />
          <span className="font-bold">Ferova OS</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          {p.sheetsLoading && (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#c9a961' }} />
          )}
          {p.spreadsheetLink && (
            <a
              href={p.spreadsheetLink}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1 hover:text-white transition"
            >
              <Database className="w-3.5 h-3.5" />
              Sheet
            </a>
          )}
          <span className="hidden md:flex items-center gap-1">
            <UserIcon className="w-3.5 h-3.5" />
            {p.user.email}
          </span>
          <button
            onClick={p.onSignOut}
            className="flex items-center gap-1 hover:text-white transition"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            p.isMobileMenuOpen ? 'block' : 'hidden'
          } md:block w-56 flex-shrink-0 p-3 space-y-1`}
          style={{
            backgroundColor: '#13110e',
            borderRight: '1px solid #2a2620',
            minHeight: 'calc(100vh - 56px)',
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                p.setActiveTab(t.id);
                p.setIsMobileMenuOpen(false);
              }}
              className="block w-full text-left px-3 py-2 rounded text-sm transition"
              style={{
                backgroundColor:
                  p.activeTab === t.id ? 'rgba(201,169,97,0.15)' : 'transparent',
                color: p.activeTab === t.id ? '#c9a961' : '#a1a1aa',
              }}
            >
              {t.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 overflow-x-auto">
          {p.errorMsg && (
            <div
              className="mb-4 p-3 rounded-lg text-xs flex items-start gap-2"
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.4)',
                color: '#fca5a5',
              }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{p.errorMsg}</span>
            </div>
          )}

          {p.activeTab === 'dashboard' && (
            <Dashboard
              appData={p.appData}
              metrics={p.metrics as any}
              selectedMonth={p.selectedMonth}
              setSelectedMonth={p.setSelectedMonth}
              months={p.months}
            />
          )}
          {p.activeTab === 'clientes' && (
            <ClientesAdmin
              clientes={p.appData.clientes ?? []}
              setClientes={(v: Cliente[]) => persist('clientes', v as any)}
            />
          )}
          {p.activeTab === 'servicios' && (
            <ServiciosAdmin
              servicios={p.appData.servicios ?? []}
              setServicios={(v: Servicio[]) => persist('servicios', v as any)}
            />
          )}
          {p.activeTab === 'ventas' && (
            <VentasAdmin
              ventas={p.appData.ventas ?? []}
              setVentas={(v: Venta[]) => persist('ventas', v as any)}
              clientes={p.appData.clientes ?? []}
              servicios={p.appData.servicios ?? []}
              config={p.appData.config}
            />
          )}
          {p.activeTab === 'horas' && (
            <HorasAdmin
              horas={p.appData.horas ?? []}
              setHoras={(v: Hora[]) => persist('horas', v as any)}
              servicios={p.appData.servicios ?? []}
              clientes={p.appData.clientes ?? []}
            />
          )}
          {p.activeTab === 'gastos' && (
            <GastosAdmin
              herramientas={p.appData.herramientas ?? []}
              setHerramientas={(v: Herramienta[]) =>
                persist('herramientas', v as any)
              }
              otrosGastos={p.appData.otrosGastos ?? []}
              setOtrosGastos={(v: OtroGasto[]) =>
                persist('otrosGastos', v as any)
              }
              servicios={p.appData.servicios ?? []}
              config={p.appData.config}
            />
          )}
          {p.activeTab === 'pagos' && (
            <PagosEgresosAdmin
              pagos={(p.appData as any).pagosEgresos ?? []}
              setPagos={(v: PagoEgreso[]) =>
                persist('pagosEgresos' as any, v as any)
              }
              herramientas={p.appData.herramientas ?? []}
              otrosGastos={p.appData.otrosGastos ?? []}
            />
          )}
          {p.activeTab === 'proyectos' && (
            <ProyectosAdmin
              appData={p.appData}
              setAppData={p.setAppData as any}
              spreadsheetId={p.spreadsheetId}
              accessToken={p.providerToken}
            />
          )}
          {p.activeTab === 'equilibrio' && (
            <EquilibrioGlobal appData={p.appData} metrics={p.metrics as any} />
          )}
          {p.activeTab === 'equilibrioServicio' && (
            <EquilibrioServicio appData={p.appData} />
          )}
          {p.activeTab === 'iva' && <ImpuestosIva appData={p.appData} />}
          {p.activeTab === 'alertas' && <AlertasTributarias appData={p.appData} />}
          {p.activeTab === 'config' && (
            <ConfigAdmin
              config={p.appData.config}
              setConfig={async (c: Config) => {
                p.setAppData((prev) => (prev ? { ...prev, config: c } : prev));
                try {
                  await updateConfigInSheet(p.spreadsheetId, p.providerToken, c);
                } catch (err: any) {
                  p.setErrorMsg(err?.message ?? 'Error al guardar config');
                }
              }}
              onRefresh={p.onRefresh}
            />
          )}
        </main>
      </div>
    </div>
  );
}

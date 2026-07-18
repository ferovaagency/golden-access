import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { initAuth, googleSignIn, linkGoogleIdentity, logout, getAccessToken, checkSubscription, hydrateGoogleWorkspaceConnection } from './lib/supabase';
import { backupAppDataToSheets, importSheetByUrl } from './lib/sheetsService';
import * as financeService from './lib/financeService';
import { isTeamMember } from './lib/crmService';
import { Config, AppData, Cliente, Servicio, Herramienta, OtroGasto, Venta, Hora, PagoEgreso } from './types';
import { calcularMétricasFinancieras } from './lib/calculations';

// Unified Premium View Components
import Home from './components/Home';
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
import AuthScreen from './components/AuthScreen';
import Paywall from './components/Paywall';
import AdminCRM, { CRMTab } from './components/AdminCRM';
import BusinessAssistant from './components/BusinessAssistant';


import { 
  Building2, 
  User as UserIcon, 
  LogOut, 
  Database, 
  Calendar, 
  Loader2, 
  AlertCircle,
  Boxes,
  FolderKanban,
  Grid2X2,
  LayoutDashboard,
  Menu,
  Settings,
  X
} from 'lucide-react';

const CRM_TAB_IDS: CRMTab[] = ['pipeline', 'citas', 'contenido', 'bot', 'resenas'];

type NavigationItem = { id: string; label: string; hint: string };
type NavigationSection = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; items: NavigationItem[] };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasPaid, setHasPaid] = useState(false);
  const [isTeam, setIsTeam] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);


  
  // Finance data state (Supabase)
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Google Sheets backup (optional, manual)
  const [isBackingUpToSheets, setIsBackingUpToSheets] = useState(false);
  const [lastSheetBackupLink, setLastSheetBackupLink] = useState<string | null>(null);

  // Filter and view state
  const [selectedMonth, setSelectedMonth] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);

  // Header TRM Quick Edit
  const [headerTrm, setHeaderTrm] = useState<string>('');
  const [isEditingTrm, setIsEditingTrm] = useState(false);

  useEffect(() => {
    if (appData?.config?.trm) {
      setHeaderTrm(String(appData.config.trm));
    }
  }, [appData?.config?.trm]);

  useEffect(() => {
    // Listen for Auth events (Supabase)
    const unsubscribe = initAuth(
      async (fUser: User) => {
        setUser(fUser);
        setAuthLoading(false);
        setCheckingPayment(true);
        const [paid, team] = await Promise.all([
          checkSubscription(fUser.id),
          isTeamMember(fUser.email || '').catch(() => false),
        ]);
        setHasPaid(paid || team);
        setIsTeam(team);
        setCheckingPayment(false);
        if (paid || team) {
          bootstrapFinanceData(fUser.id);
        }
      },
      () => {
        setUser(null);
        setHasPaid(false);
        setIsTeam(false);
        setAuthLoading(false);
        setAppData(null);
      }
    );


    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setErrorMsg(null);
      await googleSignIn();
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(`Fallo al autenticar: ${err.message || err}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Signout error:', err);
    }
  };

  // Load finance data from Supabase (source of truth) on login / refresh
  const bootstrapFinanceData = async (userId: string) => {
    setSheetsLoading(true);
    setErrorMsg(null);
    try {
      const data = await financeService.loadFinanceData(userId);
      await hydrateGoogleWorkspaceConnection(userId);
      setAppData(data);
    } catch (err: any) {
      console.error('Finance data bootstrap error:', err);
      setErrorMsg(`Error al cargar tus datos financieros: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  // Optional manual backup to the user's own Google Sheet
  const handleBackupToSheets = async () => {
    if (!appData) return;
    let token = getAccessToken();
    if (!token) {
      try {
        if (user?.identities?.some((i) => i.provider === 'google')) {
          await googleSignIn();
        } else {
          await linkGoogleIdentity();
        }
      } catch (err: any) {
        alert(`No se pudo iniciar la conexión con Google: ${err.message || err}`);
      }
      // El flujo de OAuth redirige la página; el usuario deberá pulsar "Respaldar ahora" de nuevo tras volver.
      return;
    }

    setIsBackingUpToSheets(true);
    try {
      const { sheetLink } = await backupAppDataToSheets(appData, token);
      setLastSheetBackupLink(sheetLink);
      alert('✨ ¡Respaldo en Google Sheets actualizado con éxito!');
    } catch (err: any) {
      alert(`Fallo en el respaldo a Sheets: ${err.message || err}`);
    } finally {
      setIsBackingUpToSheets(false);
    }
  };

  const persistImportedFinanceData = async (data: AppData) => {
    if (!user) return;
    await financeService.saveImportedFinanceData(user.id, data);
    const fresh = await financeService.loadFinanceData(user.id);
    setAppData(fresh);
  };

  // Import from a Google Sheet by pasting its URL. Uses the connected Google token when available,
  // so private sheets shared with that account work; falls back to public CSV for public sheets.
  const handleImportFromSheetsUrl = async (rawUrl: string) => {
    if (!user) return;
    const url = (rawUrl || '').trim();
    if (!url) { alert('Pega el link de tu Google Sheet.'); return; }
    if (!confirm('Esto reemplazará tus datos actuales con los de la hoja indicada. ¿Continuar?')) return;
    setSheetsLoading(true);
    try {
      const data = await importSheetByUrl(url, getAccessToken());
      await persistImportedFinanceData(data);
      alert('✨ Importación completada.');
    } catch (err: any) {
      alert(`Fallo al importar: ${err.message || err}\n\nAsegúrate de:\n1) Que la hoja esté compartida con la cuenta Google conectada o pública con link.\n2) Que tenga las pestañas: Config, Clientes, Servicios, Herramientas, OtrosGastos, Ventas, Horas, PagosEgresos.`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleImportFromSheets = async () => {
    if (!user) return;
    const token = getAccessToken();
    if (!token) {
      try { await googleSignIn(); }
      catch (err: any) { alert(`No se pudo conectar Google: ${err.message || err}`); }
      return;
    }
    if (!confirm('Esto buscará tu hoja "Ferova_OS_Financiero" en Google Drive y reemplazará tus datos actuales. ¿Continuar?')) return;
    setSheetsLoading(true);
    try {
      const sheet = await import('./lib/sheetsService').then((m) => m.findSpreadsheet(token));
      if (!sheet?.id) throw new Error('No encontré una hoja llamada Ferova_OS_Financiero en tu Google Drive. También puedes pegar el link exacto abajo.');
      const data = await import('./lib/sheetsService').then((m) => m.fetchSpreadsheetData(sheet.id, token));
      await persistImportedFinanceData(data);
      alert('✨ Hoja importada desde tu Google Drive.');
    } catch (err: any) {
      alert(`Fallo al importar tu hoja: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };


  // --- PERSISTENCE HANDLERS ---
  const handleSaveClientes = async (updatedClientes: Cliente[]) => {
    if (!appData || !user) return;
    setSheetsLoading(true);
    try {
      await financeService.saveClientes(user.id, updatedClientes);
      setAppData({ ...appData, clientes: updatedClientes });
    } catch (err: any) {
      alert(`Error guardando clientes: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveServicios = async (updatedServicios: Servicio[]) => {
    if (!appData || !user) return;
    setSheetsLoading(true);
    try {
      await financeService.saveServicios(user.id, updatedServicios);
      setAppData({ ...appData, servicios: updatedServicios });
    } catch (err: any) {
      alert(`Error guardando servicios: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveHerramientas = async (updatedHerramientas: Herramienta[]) => {
    if (!appData || !user) return;
    setSheetsLoading(true);
    try {
      await financeService.saveHerramientas(user.id, updatedHerramientas);
      setAppData({ ...appData, herramientas: updatedHerramientas });
    } catch (err: any) {
      alert(`Error guardando herramientas: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveOtrosGastos = async (updatedGastos: OtroGasto[]) => {
    if (!appData || !user) return;
    setSheetsLoading(true);
    try {
      await financeService.saveOtrosGastos(user.id, updatedGastos);
      setAppData({ ...appData, otrosGastos: updatedGastos });
    } catch (err: any) {
      alert(`Error guardando gastos: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSavePagosEgresos = async (updatedPagos: PagoEgreso[]) => {
    if (!appData || !user) return;
    setSheetsLoading(true);
    try {
      await financeService.savePagosEgresos(user.id, updatedPagos);
      setAppData({ ...appData, pagosEgresos: updatedPagos });
    } catch (err: any) {
      alert(`Error guardando pagos/egresos: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveVentas = async (updatedVentas: Venta[]) => {
    if (!appData || !user) return;
    setSheetsLoading(true);
    try {
      await financeService.saveVentas(user.id, updatedVentas);
      setAppData({ ...appData, ventas: updatedVentas });
    } catch (err: any) {
      alert(`Error guardando ventas: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveHoras = async (updatedHoras: Hora[]) => {
    if (!appData || !user) return;
    setSheetsLoading(true);
    try {
      await financeService.saveHoras(user.id, updatedHoras);
      setAppData({ ...appData, horas: updatedHoras });
    } catch (err: any) {
      alert(`Error guardando horas: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveConfig = async (updatedConfig: Partial<Config>) => {
    if (!appData || !user) return;
    setSheetsLoading(true);
    try {
      const fullConfig = { ...appData.config, ...updatedConfig };
      await financeService.saveConfig(user.id, fullConfig);
      setAppData({ ...appData, config: fullConfig });
    } catch (err: any) {
      alert(`Error actualizando constantes: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  // --- UTILITIES TO FORMAT VALUES ---
  const formatCop = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatUsd = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(val);
  };

  // Ruta oculta del CRM interno de Ferova (no forma parte del producto que se vende).
  // No requiere pago: la autorización real la da la lista blanca crm_team_members (RLS),
  // AdminCRM se encarga de verificarla y de rechazar a cualquiera que no esté en ella.
  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  if (isAdminRoute) {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      );
    }
    if (!user) return <AuthScreen />;
    return <AdminCRM user={user} />;
  }

  if (authLoading || checkingPayment) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-900">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs font-semibold font-mono tracking-widest text-slate-500">
            {authLoading ? 'AUTENTICANDO SESIÓN...' : 'VERIFICANDO LICENCIA...'}
          </p>
        </div>
      </div>
    );
  }

  // Estado 1: No logueado
  if (!user) {
    return <AuthScreen />;
  }

  // Estado 2: Logueado pero sin pago
  if (!hasPaid) {
    return (
      <Paywall
        user={user}
        onPaid={async () => {
          setHasPaid(true);
          bootstrapFinanceData(user.id);
        }}
      />
    );
  }

  // Estado 3: Pagado => Dashboard (los datos viven en Supabase, Google es solo respaldo opcional)

  const isReady = appData !== null;
  const metrics = isReady ? calcularMétricasFinancieras(appData, selectedMonth) : null;

  // Visual Tab Categorization - Separates Operational Management from Financial Control
  const GESTION_OPERATIVA_TABS = [
    { id: 'proyectos', label: 'Proyectos', hint: 'KPIs y ejecución' },
    { id: 'horas', label: 'Horas', hint: 'Rentabilidad por tiempo' },
    { id: 'clientes', label: 'Clientes', hint: 'Cuentas activas' },
    { id: 'servicios', label: 'Servicios', hint: 'Catálogo y costos' }
  ];

  const GESTION_FINANCIERA_TABS = [
    { id: 'dashboard', label: 'Inicio financiero', hint: 'Vista ejecutiva' },
    { id: 'ventas', label: 'Ingresos', hint: 'Ventas y abonos' },
    { id: 'pagosEgresos', label: 'Pagos', hint: 'Egresos registrados' },
    { id: 'gastos', label: 'Costos', hint: 'Herramientas y gastos' },
    { id: 'equilibrioGlobal', label: 'Equilibrio', hint: 'Punto global' },
    { id: 'equilibrioServicio', label: 'Por servicio', hint: 'Margen unitario' },
    { id: 'iva', label: 'IVA', hint: 'Control tributario' },
    { id: 'alertas', label: 'Alertas', hint: 'Riesgos y topes' },
    { id: 'ajustes', label: 'Ajustes', hint: 'Google Sheets y datos' }
  ];

  const CRM_GROWTH_TABS = isTeam ? [
    { id: 'crm-pipeline', label: 'Pipeline', hint: 'Prospectos y playbooks' },
    { id: 'crm-citas', label: 'Citas', hint: 'Diagnósticos y Calendar' },
    { id: 'crm-contenido', label: 'LinkedIn + Reddit', hint: 'Señales automáticas' },
    { id: 'crm-bot', label: 'Bot WhatsApp', hint: 'Conocimiento y estado' },
    { id: 'crm-resenas', label: 'Reseñas', hint: 'Gmail y fuentes' },
  ] : [];

  const TAB_SET = [...GESTION_OPERATIVA_TABS, ...GESTION_FINANCIERA_TABS, ...CRM_GROWTH_TABS];

  const NAVIGATION_SECTIONS: NavigationSection[] = [
    { id: 'home', label: 'Home', icon: LayoutDashboard, items: [{ id: 'dashboard', label: 'Executive Control Center', hint: 'Vista ejecutiva y prioridades' }] },
    { id: 'workspace', label: 'Workspace', icon: Boxes, items: [
      { id: 'clientes', label: 'Clientes', hint: 'Cuentas activas' },
      { id: 'servicios', label: 'Servicios', hint: 'Catálogo y costos' },
      { id: 'horas', label: 'Horas', hint: 'Capacidad y rentabilidad' },
    ] },
    { id: 'projects', label: 'Projects', icon: FolderKanban, items: [{ id: 'proyectos', label: 'Proyectos', hint: 'KPIs y ejecución' }] },
    { id: 'modules', label: 'Modules', icon: Grid2X2, items: [
      { id: 'ventas', label: 'Ingresos', hint: 'Ventas y abonos' },
      { id: 'pagosEgresos', label: 'Pagos', hint: 'Egresos registrados' },
      { id: 'gastos', label: 'Costos', hint: 'Herramientas y gastos' },
      { id: 'equilibrioGlobal', label: 'Equilibrio', hint: 'Punto global' },
      { id: 'equilibrioServicio', label: 'Por servicio', hint: 'Margen unitario' },
      { id: 'iva', label: 'IVA', hint: 'Control tributario' },
      { id: 'alertas', label: 'Alertas', hint: 'Riesgos y topes' },
      ...CRM_GROWTH_TABS,
    ] },
    { id: 'settings', label: 'Settings', icon: Settings, items: [{ id: 'ajustes', label: 'Configuración', hint: 'Datos y Google Sheets' }] },
  ];

  const activeSectionId = NAVIGATION_SECTIONS.find((section) => section.items.some((item) => item.id === activeTab))?.id ?? 'home';
  const navigateTo = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={`ferova-light-theme min-h-screen bg-[#f7f8fb] flex flex-col text-[#1f2937] font-sans transition-[padding] ${assistantCollapsed ? '' : 'xl:pr-[360px]'}`}>
      
      {/* 1. Header component */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-[#dbe4ee] relative z-20">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold">
              F
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold font-display tracking-tight text-slate-900">Ferova OS</h1>
                <span className="text-[10px] bg-blue-50 border border-blue-100 font-medium text-blue-700 px-2 py-0.5 rounded-full">
                  Finanzas + Growth
                </span>
              </div>
              <span className="text-xs text-slate-500 block mt-0.5">
                Navegación clara por módulos de negocio
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            
            {/* 1.1 TRM Editable Quick Panel */}
            {isReady && appData && (
              <div className="hidden md:flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 text-xs shadow-sm">
                <span className="text-slate-500 text-xs">TRM</span>
                {isEditingTrm ? (
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const val = Number(headerTrm);
                      if (val > 0) {
                        try {
                          await handleSaveConfig({ trm: val });
                          setIsEditingTrm(false);
                        } catch (err: any) {
                          alert(`Error de guardado TRM: ${err.message || err}`);
                        }
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input 
                      type="number"
                      value={headerTrm}
                      onChange={(e) => setHeaderTrm(e.target.value)}
                      className="w-16 bg-slate-50 text-slate-900 border border-slate-200 p-0.5 px-1 rounded text-xs font-mono focus:outline-none focus:border-[#c9a961]"
                      autoFocus
                    />
                    <button 
                      type="submit" 
                      className="text-emerald-600 hover:text-emerald-700 font-bold px-1 cursor-pointer"
                      title="Guardar TRM"
                    >
                      ✓
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setHeaderTrm(String(appData.config.trm));
                        setIsEditingTrm(false);
                      }} 
                      className="text-[#c97a61] hover:text-[#c97a61]/80 font-bold px-1 cursor-pointer"
                      title="Cancelar"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-blue-600 font-bold">{formatCop(appData.config.trm)}</span>
                    <button 
                      onClick={() => setIsEditingTrm(true)}
                      className="text-slate-400 hover:text-slate-900 text-[9px] hover:underline cursor-pointer"
                    >
                      [✏️]
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 1.2 Display de Clientes Activos */}
            {isReady && appData && (
                <div className="hidden sm:flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-slate-200 text-xs text-slate-600 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>
                  CLIENTES: <strong className="text-slate-900">{appData.clientes.filter(c => c.activo).length}</strong>
                </span>
              </div>
            )}
            
            {/* Google Sheets backup link, if one exists */}
            {lastSheetBackupLink && (
              <a
                href={lastSheetBackupLink}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-100 hover:bg-[#23201c] transition px-3 py-1.5 rounded border border-slate-200 text-xs font-mono text-slate-500 flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Respaldo en Sheets</span>
              </a>
            )}

            {/* Profile component user info */}
              <button onClick={() => setAssistantCollapsed((value) => !value)} className="hidden md:flex items-center gap-2 rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700">
                {assistantCollapsed ? 'Abrir asistente' : 'Colapsar asistente'}
              </button>

              <div className="flex items-center gap-2.5 bg-white p-1.5 pr-3.5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="w-7 h-7 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center">
                <UserIcon className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="hidden md:block text-left text-[10px] leading-tight">
                <span className="font-semibold text-slate-900 block">{(user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || 'Mafe'}</span>
                <span className="text-slate-400 block font-mono text-[9px] max-w-40 truncate">{user.email}</span>
              </div>
              
              <button 
                onClick={handleSignOut}
                className="bg-slate-50/60 p-1.5 rounded border border-slate-200 text-slate-400 hover:text-[#c97a61] cursor-pointer transition ml-1"
                title="Cerrar sesion Workspace"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile menu trigger */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden bg-white border border-slate-200 p-2 rounded text-slate-500"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>

        </div>
      </header>

      {/* Sync Banner */}
      {sheetsLoading && (
        <div className="bg-blue-50 border-b border-blue-100 text-blue-700 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Guardando cambios en la base de datos...</span>
        </div>
      )}

      {/* 2. Global Period Selection Rail */}
      {isReady && appData && (
        <div className="bg-white/90 border-b border-slate-200 py-3 text-xs">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="font-mono text-slate-500 text-[10px] uppercase font-bold tracking-wider">Ventana Periodo DIAN:</span>
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-50 text-slate-900 border border-slate-200 text-xs p-1 rounded font-mono focus:outline-none focus:border-[#c9a961]"
              >
                <option value="Todos">Histórico Completo (COP)</option>
                {Array.from({ length: 12 }).map((_, i) => {
                  const mStr = `2026-${String(i + 1).padStart(2, '0')}`;
                  return (
                    <option key={mStr} value={mStr}>{mStr}</option>
                  );
                })}
              </select>
            </div>

            {/* Quick calculations layout bar */}
            {metrics && (
              <div className="flex items-center gap-4 text-[10px] font-mono tracking-wider text-slate-500">
                <div>
                  <span>FACTURACIÓN:</span> <strong className="text-slate-900">{formatCop(metrics.totalVentas)}</strong>
                </div>
                <div className="w-px h-3 bg-[#2a2620]" />
                <div>
                  <span>NÓMINA RETIROS:</span> <strong className="text-slate-900">{formatCop(metrics.salarioPropuesto)}</strong>
                </div>
                <div className="w-px h-3 bg-[#2a2620]" />
                <div>
                  <span>NETO DISPONIBLE:</span>{' '}
                  <strong style={{ color: metrics.utilidadNeta >= 0 ? '#a8c98a' : '#c97a61' }}>
                    {formatCop(metrics.utilidadNeta)}
                  </strong>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 3. Main layout tabs container */}
       <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        
        {/* Top-level navigation: every existing page lives inside one of five sections. */}
        <aside className="hidden shrink-0 lg:block lg:w-72">
          <nav className="space-y-2 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/30">
            {NAVIGATION_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSectionId;
              return (
                <div key={section.id} className="rounded-2xl">
                  <button onClick={() => navigateTo(section.items[0].id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${isActive ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>
                    <Icon className="h-4 w-4" />
                    {section.label}
                  </button>
                  {isActive && (
                    <div className="space-y-1 px-2 pb-2 pt-2">
                      {section.items.map((item) => (
                        <button key={item.id} onClick={() => navigateTo(item.id)} className={`w-full rounded-lg px-3 py-2 text-left transition ${activeTab === item.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                          <span className="block text-xs font-semibold">{item.label}</span>
                          <span className="block pt-0.5 text-[11px] font-normal opacity-70">{item.hint}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Legacy navigation retained temporarily for tab compatibility; not rendered. */}
        <aside className="hidden">
          
          <div>
            <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-blue-600 block px-3 mb-2 font-black border-l-2 border-l-[#c9a961] pl-2">
              Gestión Operativa
            </span>
            <nav className="space-y-1 text-sm font-semibold">
              {GESTION_OPERATIVA_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl transition border ${
                    activeTab === tab.id 
                      ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-sm' 
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-white hover:border-slate-200'
                  }`}
                >
                  <span className="block">{tab.label}</span>
                  <span className="block text-xs font-normal opacity-70">{tab.hint}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="pt-2 border-t border-slate-200/45">
            <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-slate-500 block px-3 mb-2 font-black border-l-2 border-l-[#a39d8e] pl-2">
              Control Financiero
            </span>
            <nav className="space-y-1 text-sm font-semibold">
              {GESTION_FINANCIERA_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl transition border ${
                    activeTab === tab.id 
                      ? 'bg-blue-50 text-blue-700 border-blue-100 shadow-sm' 
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-white hover:border-slate-200'
                  }`}
                >
                  <span className="block">{tab.label}</span>
                  <span className="block text-xs font-normal opacity-70">{tab.hint}</span>
                </button>
              ))}
            </nav>
          </div>

          {isTeam && CRM_GROWTH_TABS.length > 0 && (
            <div className="pt-2 border-t border-slate-200/45">
              <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-emerald-600 block px-3 mb-2 font-black border-l-2 border-l-[#a8c98a] pl-2">
                Growth · CRM Interno
              </span>
              <nav className="space-y-1 text-sm font-semibold">
                {CRM_GROWTH_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-3 rounded-2xl transition border ${
                      activeTab === tab.id
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm'
                        : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-white hover:border-slate-200'
                    }`}
                  >
                    <span className="block">{tab.label}</span>
                    <span className="block text-xs font-normal opacity-70">{tab.hint}</span>
                  </button>
                ))}
              </nav>
            </div>
          )}

        </aside>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/20 lg:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="h-full w-72 overflow-y-auto border-l border-slate-200 bg-white p-5" onClick={(event) => event.stopPropagation()}>
              <div className="mb-5 flex items-center justify-between"><span className="text-sm font-semibold text-slate-900">Navigation</span><button onClick={() => setIsMobileMenuOpen(false)} className="text-xs font-medium text-slate-500">Cerrar</button></div>
              <nav className="space-y-2">
                {NAVIGATION_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = section.id === activeSectionId;
                  return <div key={section.id}><button onClick={() => navigateTo(section.items[0].id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${isActive ? 'bg-slate-950 text-white' : 'text-slate-600'}`}><Icon className="h-4 w-4" />{section.label}</button>{isActive && <div className="space-y-1 px-2 pb-2 pt-2">{section.items.map((item) => <button key={item.id} onClick={() => navigateTo(item.id)} className={`w-full rounded-lg px-3 py-2 text-left text-xs ${activeTab === item.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-500'}`}>{item.label}</button>)}</div>}</div>;
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Legacy mobile navigation retained temporarily for tab compatibility; not rendered. */}
        {false && isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-35 bg-slate-900/20 flex justify-end" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="w-64 bg-white border-l border-slate-200 h-full p-5 space-y-4 text-xs font-mono overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-2">
                <span className="font-semibold text-blue-600">Menú Corporativo</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400">Cerrar</button>
              </div>
              
              <div className="space-y-4 text-left">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-blue-600/70 block font-bold mb-1.5 font-mono">1. GESTIÓN OPERATIVA</span>
                  <nav className="space-y-1">
                    {GESTION_OPERATIVA_TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded transition ${
                          activeTab === tab.id 
                            ? 'bg-blue-50 text-blue-600 font-semibold' 
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="pt-2 border-t border-slate-200/45">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500/70 block font-bold mb-1.5 font-mono">2. CONTROL FINANCIERO</span>
                  <nav className="space-y-1">
                    {GESTION_FINANCIERA_TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded transition ${
                          activeTab === tab.id 
                            ? 'bg-blue-50 text-blue-600 font-semibold' 
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>

                {isTeam && CRM_GROWTH_TABS.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/45">
                    <span className="text-[9px] uppercase tracking-wider text-emerald-600/80 block font-bold mb-1.5 font-mono">3. GROWTH · CRM INTERNO</span>
                    <nav className="space-y-1">
                      {CRM_GROWTH_TABS.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 rounded transition ${
                            activeTab === tab.id ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Content body layout container */}
        <div className="flex-1 min-w-0">
          
          {/* Error alerts */}
          {errorMsg && (
            <div className="bg-[#c97a61]/10 border border-[#c97a61]/25 rounded p-4 flex gap-3 text-xs text-slate-900 mb-6">
              <AlertCircle className="w-5 h-5 text-[#c97a61] shrink-0 mt-0.5" />
              <div className="space-y-1.5 w-full">
                <span className="font-semibold font-display text-[#c97a61] block">Inconveniente de Sincronización</span>
                <p className="text-slate-500 leading-relaxed">{errorMsg}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-[#c97a61]/15 mt-2 items-center">
                  <button
                    onClick={() => user && bootstrapFinanceData(user.id)}
                    className="underline text-slate-900 font-mono font-bold hover:text-blue-600 cursor-pointer"
                  >
                    Intentar reconexión manual
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="underline text-slate-500 font-mono hover:text-slate-900 cursor-pointer"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Load databases spinner */}
          {!isReady && !errorMsg && (
            <div className="bg-white border border-slate-200 rounded-lg p-16 text-center text-xs space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="font-mono text-slate-500 font-semibold tracking-wider">CARGANDO TU CONTABILIDAD...</p>
              <p className="text-slate-400 max-w-sm mx-auto leading-relaxed">
                Sincronizando clientes, ventas y parámetros DIAN 2026 desde tu cuenta.
              </p>
            </div>
          )}

          {/* ACTIVE SCREEN ROUTER FRAMEWORK */}
          {isReady && metrics && appData && (
            <div className="min-h-[500px]">
              
              {activeTab === 'dashboard' && (
                <Home
                  data={appData} 
                  metrics={metrics} 
                  selectedMonth={selectedMonth} 
                  formatCop={formatCop} 
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'ventas' && (
                <VentasAdmin 
                  ventas={appData.ventas} 
                  clientes={appData.clientes} 
                  servicios={appData.servicios} 
                  config={appData.config} 
                  onSaveVentas={handleSaveVentas} 
                  formatCop={formatCop} 
                  formatUsd={formatUsd} 
                />
              )}

              {activeTab === 'horas' && (
                <HorasAdmin 
                  horas={appData.horas} 
                  clientes={appData.clientes} 
                  servicios={appData.servicios} 
                  ventas={appData.ventas}
                  config={appData.config}
                  metrics={metrics}
                  selectedMonth={selectedMonth}
                  onSaveHoras={handleSaveHoras} 
                  onSaveConfig={handleSaveConfig}
                  formatCop={formatCop}
                />
              )}

              {activeTab === 'clientes' && (
                <ClientesAdmin 
                  clientes={appData.clientes} 
                  ventas={appData.ventas} 
                  horas={appData.horas} 
                  config={appData.config} 
                  onSaveClientes={handleSaveClientes} 
                  formatCop={formatCop} 
                  formatUsd={formatUsd} 
                />
              )}

              {activeTab === 'proyectos' && (
                <ProyectosAdmin 
                  projectData={appData}
                  onSaveClientes={handleSaveClientes}
                />
              )}

              {activeTab === 'pagosEgresos' && (
                <PagosEgresosAdmin 
                  pagosEgresos={appData.pagosEgresos || []}
                  config={appData.config}
                  onSavePagosEgresos={handleSavePagosEgresos}
                />
              )}

              {activeTab === 'gastos' && (
                <GastosAdmin 
                  herramientas={appData.herramientas} 
                  otrosGastos={appData.otrosGastos} 
                  servicios={appData.servicios} 
                  clientes={appData.clientes} 
                  config={appData.config} 
                  onSaveHerramientas={handleSaveHerramientas} 
                  onSaveOtrosGastos={handleSaveOtrosGastos} 
                  onSaveConfig={handleSaveConfig} 
                  formatCop={formatCop} 
                  formatUsd={formatUsd} 
                />
              )}

              {activeTab === 'equilibrioGlobal' && (
                <EquilibrioGlobal 
                  metrics={metrics} 
                  formatCop={formatCop} 
                />
              )}

              {activeTab === 'equilibrioServicio' && (
                <EquilibrioServicio 
                  servicios={appData.servicios} 
                  herramientas={appData.herramientas} 
                  clientes={appData.clientes} 
                  ventas={appData.ventas} 
                  config={appData.config} 
                  selectedMonth={selectedMonth} 
                  formatCop={formatCop} 
                />
              )}

              {activeTab === 'iva' && (
                <ImpuestosIva 
                  data={appData} 
                  metrics={metrics} 
                  formatCop={formatCop} 
                />
              )}

              {activeTab === 'alertas' && (
                <AlertasTributarias 
                  metrics={metrics} 
                  config={appData.config} 
                  ventas={appData.ventas} 
                  formatCop={formatCop} 
                />
              )}

              {activeTab === 'servicios' && (
                <ServiciosAdmin 
                  servicios={appData.servicios} 
                  ventas={appData.ventas} 
                  horas={appData.horas} 
                  config={appData.config} 
                  onSaveServicios={handleSaveServicios} 
                  formatCop={formatCop} 
                />
              )}

              {activeTab === 'ajustes' && (
                <ConfigAdmin
                  config={appData.config}
                  ventas={appData.ventas}
                  clientes={appData.clientes}
                  horas={appData.horas}
                  hasGoogleToken={!!getAccessToken()}
                  lastSheetBackupLink={lastSheetBackupLink}
                  isBackingUpToSheets={isBackingUpToSheets}
                  onSaveConfig={handleSaveConfig}
                  onBackupToSheets={handleBackupToSheets}
                  onImportFromSheets={handleImportFromSheets}
                  onImportFromSheetsUrl={handleImportFromSheetsUrl}
                  formatCop={formatCop}
                />
              )}

              {isTeam && activeTab.startsWith('crm-') && (
                <AdminCRM
                  user={user}
                  embedded
                  tab={activeTab.replace('crm-', '') as CRMTab}
                  onTabChange={(t) => setActiveTab(`crm-${t}`)}
                />
              )}

            </div>
          )}

        </div>

      </div>

      {/* 4. Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-[10px] font-mono text-slate-400 shrink-0 uppercase tracking-widest mt-12">
        Ferova OS © 2026 • Finanzas, Growth CRM y asistente IA con datos reales
      </footer>

      {user && <BusinessAssistant user={user} collapsed={assistantCollapsed} onToggleCollapsed={() => setAssistantCollapsed((value) => !value)} />}

    </div>
  );
}

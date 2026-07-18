import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { initAuth, googleSignIn, linkGoogleIdentity, logout, getAccessToken, resolveAccess } from './lib/supabase';
import { backupAppDataToSheets, importSheetByUrl } from './lib/sheetsService';
import * as financeService from './lib/financeService';
import { isTeamMember } from './lib/crmService';
import { getModules, type ModuleOverrides, PlanId } from './lib/planService';
import { listMyOverrides } from './lib/moduleOverridesService';
import { getBusinessProfile, BusinessProfile } from './lib/businessProfileService';
import OnboardingChat from './components/OnboardingChat';
import FeedbackWidget from './components/FeedbackWidget';
import { Config, AppData, Cliente, Servicio, Herramienta, OtroGasto, Venta, Hora, PagoEgreso } from './types';
import { calcularMétricasFinancieras } from './lib/calculations';
import { useFiscalProfile } from './hooks/useFiscalProfile';
import { isSupabaseConfigured, supabaseConfigurationError } from './integrations/supabase/client';

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
import AISidebar from './components/AISidebar';
import CustomerCRM from './components/CustomerCRM';
import SmartPlanner from './components/SmartPlanner';
import ReportsView from './components/ReportsView';
import CommandPalette from './components/CommandPalette';
import TopBar from './components/TopBar';
import FinanceOperativa from './components/FinanceOperativa';
import MarketingROI from './components/MarketingROI';

import {
  FolderKanban,
  User as UserIcon,
  LogOut,
  Loader2,
  AlertCircle,
  Boxes,
  Grid2X2,
  LayoutDashboard,
  Menu,
  Settings,
  Calendar,
  Database,
  X,
} from 'lucide-react';

type NavigationItem = { id: string; label: string; hint: string };
type NavigationSection = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; items: NavigationItem[] };

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
        <section className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><AlertCircle className="h-6 w-6" aria-hidden="true" /></div>
          <h1 className="text-xl font-bold">Configuración pendiente del despliegue</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{supabaseConfigurationError} Esta publicación de Lovable Cloud no recibió la configuración de su proyecto de datos, por lo que Ferova OS no puede conectarse todavía.</p>
          <p className="mt-4 rounded-xl bg-slate-50 p-4 font-mono text-xs leading-5 text-slate-700">VITE_SUPABASE_URL<br />VITE_SUPABASE_PUBLISHABLE_KEY</p>
          <p className="mt-4 text-xs leading-5 text-slate-500">La integración de Lovable Cloud debe inyectar estos valores al publicar. Nunca uses una clave secret o service_role en el navegador.</p>
        </section>
      </main>
    );
  }

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasPaid, setHasPaid] = useState(false);
  const [isTeam, setIsTeam] = useState(false);
  const [plan, setPlan] = useState<PlanId>('financiero');
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [moduleOverrides, setModuleOverrides] = useState<ModuleOverrides>({});
  const modules = React.useMemo(() => getModules(plan, isTeam, moduleOverrides), [plan, isTeam, moduleOverrides]);


  
  // Finance data state (Supabase)
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const { profile: fiscalProfile } = useFiscalProfile(user?.id);

  // Google Sheets backup (optional, manual)
  const [isBackingUpToSheets, setIsBackingUpToSheets] = useState(false);
  const [lastSheetBackupLink, setLastSheetBackupLink] = useState<string | null>(null);

  // Filter and view state
  const [selectedMonth, setSelectedMonth] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('ferova.ai.collapsed') === '1';
  });
  const [aiWidth, setAiWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 380;
    const v = Number(localStorage.getItem('ferova.ai.width')); return v >= 320 && v <= 640 ? v : 380;
  });
  useEffect(() => { localStorage.setItem('ferova.ai.collapsed', aiCollapsed ? '1' : '0'); }, [aiCollapsed]);
  useEffect(() => { localStorage.setItem('ferova.ai.width', String(aiWidth)); }, [aiWidth]);

  // Header TRM Quick Edit
  const [headerTrm, setHeaderTrm] = useState<string>('');
  const [isEditingTrm, setIsEditingTrm] = useState(false);

  // Global Cmd/Ctrl+K opens the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);


  // (TRM quick-edit was moved out of the shell; kept in Ajustes.)


  useEffect(() => {
    // Listen for Auth events (Supabase)
    const unsubscribe = initAuth(
      async (fUser: User) => {
        setUser(fUser);
        setAuthLoading(false);
        setCheckingPayment(true);
        const [access, team] = await Promise.all([
          resolveAccess(fUser.id, fUser.email || ''),
          isTeamMember(fUser.email || '').catch(() => false),
        ]);
        const overrides = await listMyOverrides(fUser.id).catch((error) => {
          console.error('[App] module overrides error:', error);
          return [];
        });
        setHasPaid(access.hasPaid || team);
        setPlan(access.plan);
        setIsTeam(team);
        setModuleOverrides(Object.fromEntries(overrides.map((override) => [override.module, override.enabled])) as ModuleOverrides);
        setCheckingPayment(false);
        if (access.hasPaid || team) {
          bootstrapFinanceData(fUser.id);
        }
      },
      () => {
        setUser(null);
        setHasPaid(false);
        setIsTeam(false);
        setPlan('financiero');
        setModuleOverrides({});
        setAuthLoading(false);
        setAppData(null);
      }
    );


    return () => unsubscribe();
  }, []);

  // Si el cliente no tiene el módulo Financiero (plan solo "CRM y Ventas"),
  // ninguna de estas pestañas existe para él -- redirige a su módulo real.
  // Cubre tanto el tab inicial por defecto como un cambio de plan en caliente.
  const FINANCIERO_TAB_IDS = ['dashboard', 'ventas', 'pagosEgresos', 'gastos', 'equilibrioGlobal', 'equilibrioServicio', 'iva', 'alertas', 'ajustes', 'proyectos', 'horas', 'clientes', 'servicios'];
  useEffect(() => {
    if (!appData) return;
    if (!modules.financiero && FINANCIERO_TAB_IDS.includes(activeTab)) {
      setActiveTab(modules.crm_ventas ? 'ventas-crm' : activeTab);
    }
  }, [appData, modules.financiero, modules.crm_ventas, activeTab]);

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
      const [data] = await Promise.all([
        financeService.loadFinanceData(userId),
        getBusinessProfile(userId).then(setBusinessProfile).catch((err) => {
          console.error('[App] getBusinessProfile error:', err);
        }),
      ]);
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
      alert(`Fallo al importar: ${err.message || err}\n\nAsegúrate de:\n1) Que la hoja esté compartida con la cuenta Google conectada o pública con link.\n2) Que use la estructura Ferova_OS_Financiero y tenga estas pestañas exactas: Config, Clientes, Servicios, Herramientas, OtrosGastos, Ventas, Horas, Respaldos y PagosEgresos.`);
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

  // /admin y otras rutas ahora las maneja src/router.tsx — este componente
  // solo renderiza el shell del producto en "/".

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

  // Estado 2.5: pagó pero todavía no completó el onboarding de su negocio.
  // Los miembros del equipo de Ferova (isTeam) no son clientes reales, no pasan por esto.
  const isReady = appData !== null;
  if (isReady && !isTeam && !businessProfile?.onboarding_completado) {
    return <OnboardingChat user={user} onDone={(profile) => setBusinessProfile(profile)} />;
  }

  // Estado 3: Pagado => Dashboard (los datos viven en Supabase, Google es solo respaldo opcional)

  const metrics = isReady ? calcularMétricasFinancieras(appData, selectedMonth, fiscalProfile) : null;

  // Visual Tab Categorization - Separates Operational Management from Financial Control
  // Ambos bloques solo se muestran si el plan del cliente incluye el módulo Financiero.
  const GESTION_OPERATIVA_TABS = modules.core_projects ? [
    { id: 'proyectos', label: 'Proyectos', hint: 'KPIs y ejecución' },
    { id: 'horas', label: 'Horas', hint: 'Rentabilidad por tiempo' },
    { id: 'clientes', label: 'Clientes', hint: 'Cuentas activas' },
    { id: 'servicios', label: 'Servicios', hint: 'Catálogo y costos' }
  ] : [];

  const GESTION_FINANCIERA_TABS = modules.financiero ? [
    { id: 'dashboard', label: 'Inicio financiero', hint: 'Vista ejecutiva' },
    { id: 'ventas', label: 'Ingresos', hint: 'Ventas y abonos' },
    { id: 'pagosEgresos', label: 'Pagos', hint: 'Egresos registrados' },
    { id: 'gastos', label: 'Costos', hint: 'Herramientas y gastos' },
    { id: 'equilibrioGlobal', label: 'Equilibrio', hint: 'Punto global' },
    { id: 'equilibrioServicio', label: 'Por servicio', hint: 'Margen unitario' },
    { id: 'iva', label: 'IVA', hint: 'Control tributario' },
    { id: 'alertas', label: 'Alertas', hint: 'Riesgos y topes' },
    { id: 'ajustes', label: 'Ajustes', hint: 'Google Sheets y datos' }
  ] : [];

  // Módulo "CRM y Ventas" propio del cliente -- distinto del CRM interno de Ferova (abajo).
  const CRM_GROWTH_TABS = isTeam ? [
    { id: 'crm-pipeline', label: 'Pipeline', hint: 'Prospectos y playbooks' },
    { id: 'crm-citas', label: 'Citas', hint: 'Diagnósticos y Calendar' },
    { id: 'crm-contenido', label: 'LinkedIn + Reddit', hint: 'Señales automáticas' },
    { id: 'crm-bot', label: 'Bot WhatsApp', hint: 'Conocimiento y estado' },
    { id: 'crm-resenas', label: 'Reseñas', hint: 'Gmail y fuentes' },
    { id: 'crm-clientes', label: 'Administración', hint: 'Usuarios, planes y feedback' },
  ] : [];

  const handleNavigate = (tab: string) => {
    if (tab === '__ai') { setAiCollapsed(false); return; }
    // The internal SaaS console has its own protected route so it can keep
    // authorization and loading states isolated from the customer workspace.
    if (tab === 'admin') { window.location.assign('/admin'); return; }
    setActiveTab(tab);
  };

  const NAVIGATION_SECTIONS: NavigationSection[] = [
    { id: 'home', label: 'Home', icon: LayoutDashboard, items: [{ id: 'dashboard', label: 'Executive Control Center', hint: 'Vista ejecutiva y prioridades' }] },
    { id: 'workspace', label: 'Workspace', icon: Boxes, items: modules.core_projects ? [
      { id: 'clientes', label: 'Clientes', hint: 'Cuentas activas' },
      { id: 'servicios', label: 'Servicios', hint: 'Catálogo y costos' },
      { id: 'horas', label: 'Horas', hint: 'Capacidad y rentabilidad' },
    ] : [] },
    { id: 'projects', label: 'Projects', icon: FolderKanban, items: modules.core_projects ? [{ id: 'proyectos', label: 'Proyectos', hint: 'KPIs y ejecución' }] : [] },
    { id: 'modules', label: 'Modules', icon: Grid2X2, items: [
      ...(modules.planner ? [{ id: 'planner', label: 'Planner', hint: 'Prioridades y bloques protegidos' }] : []),
      ...(modules.advanced_analytics ? [{ id: 'reports', label: 'Reportes CEO', hint: 'Seguimiento ejecutivo' }] : []),
      ...(modules.crm_ventas ? [{ id: 'ventas-crm', label: 'CRM y Ventas', hint: 'Tu pipeline propio' }] : []),
      ...(modules.financiero ? [
      { id: 'finops', label: 'Finanzas operativas', hint: 'Cuentas, deudas, flujo' },
      ...(modules.marketing_roi ? [{ id: 'marketingRoi', label: 'Marketing ROI', hint: 'Campañas y calculadora' }] : []),
      { id: 'ventas', label: 'Ingresos', hint: 'Ventas y abonos' },
      { id: 'pagosEgresos', label: 'Pagos', hint: 'Egresos registrados' },
      { id: 'gastos', label: 'Costos', hint: 'Herramientas y gastos' },
      { id: 'equilibrioGlobal', label: 'Equilibrio', hint: 'Punto global' },
      { id: 'equilibrioServicio', label: 'Por servicio', hint: 'Margen unitario' },
      { id: 'iva', label: 'IVA', hint: 'Control tributario' },
      { id: 'alertas', label: 'Alertas', hint: 'Riesgos y topes' },
      ] : []),
      ...CRM_GROWTH_TABS,
    ] },
    { id: 'settings', label: 'Settings', icon: Settings, items: [
      ...(modules.financiero ? [{ id: 'ajustes', label: 'Configuración', hint: 'Datos y Google Sheets' }] : []),
      ...(isTeam ? [{ id: 'admin', label: 'Administración Ferova', hint: 'Usuarios, planes, feedback y operaciones' }] : []),
    ] },
  ];

  const activeSectionId = NAVIGATION_SECTIONS.find((section) => section.items.some((item) => item.id === activeTab))?.id ?? 'home';
  const visibleNavigationSections = NAVIGATION_SECTIONS.filter((section) => section.items.length > 0);
  const navigateTo = (tab: string) => {
    if (tab === 'admin') { window.location.assign('/admin'); return; }
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="ferova-light-theme min-h-screen bg-[#f7f8fb] flex flex-col text-[#1f2937] font-sans">
      
      {/* 1. Header component */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-[#dbe4ee] relative z-20">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-sm font-bold">
              F
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold font-display tracking-tight text-slate-900">{businessProfile?.nombre_negocio || 'Ferova OS'}</h1>
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
              <button onClick={() => setAiCollapsed((value) => !value)} className="hidden md:flex items-center gap-2 rounded-2xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700">
                {aiCollapsed ? 'Abrir asistente' : 'Colapsar asistente'}
              </button>
              {!isTeam && <FeedbackWidget user={user} />}

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
            {visibleNavigationSections.map((section) => {
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

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <TopBar userId={user.id} onOpenPalette={() => setPaletteOpen(true)} onNavigate={handleNavigate} />
        {sheetsLoading && (
          <div className="bg-blue-50 border-b border-blue-100 text-blue-700 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando cambios…
          </div>
        )}

        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
          {errorMsg && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 flex gap-3 text-sm text-red-900">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1.5 w-full">
                <p className="font-semibold">Inconveniente de sincronización</p>
                <p className="text-red-700 leading-relaxed">{errorMsg}</p>
                <button onClick={() => user && bootstrapFinanceData(user.id)} className="underline text-red-900 font-semibold text-xs">Reintentar</button>
              </div>
            </div>
          )}

          {!isReady && !errorMsg && (
            <div className="rounded-2xl border border-[var(--line)] bg-white p-16 text-center space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
              <p className="text-sm text-slate-500">Cargando tu negocio…</p>
            </div>
          )}

          {isReady && metrics && appData && (
            <>
              {activeTab === 'planner' && <SmartPlanner />}
              {activeTab === 'reports' && user && <ReportsView user={user} />}
              {activeTab === 'finops' && <FinanceOperativa user={user} appData={appData} formatCop={formatCop} />}
              {activeTab === 'marketingRoi' && <MarketingROI user={user} formatCop={formatCop} />}
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
                <VentasAdmin ventas={appData.ventas} clientes={appData.clientes} servicios={appData.servicios} config={appData.config} onSaveVentas={handleSaveVentas} formatCop={formatCop} formatUsd={formatUsd} />
              )}
              {activeTab === 'horas' && (
                <HorasAdmin horas={appData.horas} clientes={appData.clientes} servicios={appData.servicios} ventas={appData.ventas} config={appData.config} metrics={metrics} selectedMonth={selectedMonth} onSaveHoras={handleSaveHoras} onSaveConfig={handleSaveConfig} formatCop={formatCop} />
              )}
              {activeTab === 'clientes' && (
                <ClientesAdmin clientes={appData.clientes} ventas={appData.ventas} horas={appData.horas} config={appData.config} onSaveClientes={handleSaveClientes} formatCop={formatCop} formatUsd={formatUsd} />
              )}
              {activeTab === 'proyectos' && (
                <ProyectosAdmin 
                  projectData={appData}
                  onSaveClientes={handleSaveClientes}
                />
              )}
              {activeTab === 'pagosEgresos' && (
                <PagosEgresosAdmin pagosEgresos={appData.pagosEgresos || []} config={appData.config} onSavePagosEgresos={handleSavePagosEgresos} />
              )}
              {activeTab === 'gastos' && (
                <GastosAdmin herramientas={appData.herramientas} otrosGastos={appData.otrosGastos} servicios={appData.servicios} clientes={appData.clientes} config={appData.config} fiscalProfile={fiscalProfile} onSaveHerramientas={handleSaveHerramientas} onSaveOtrosGastos={handleSaveOtrosGastos} onSaveConfig={handleSaveConfig} formatCop={formatCop} formatUsd={formatUsd} />
              )}
              {activeTab === 'equilibrioGlobal' && <EquilibrioGlobal metrics={metrics} formatCop={formatCop} />}
              {activeTab === 'equilibrioServicio' && (
                <EquilibrioServicio servicios={appData.servicios} herramientas={appData.herramientas} clientes={appData.clientes} ventas={appData.ventas} config={appData.config} selectedMonth={selectedMonth} formatCop={formatCop} />
              )}
              {activeTab === 'iva' && <ImpuestosIva data={appData} metrics={metrics} formatCop={formatCop} />}
              {activeTab === 'alertas' && <AlertasTributarias metrics={metrics} config={appData.config} ventas={appData.ventas} formatCop={formatCop} />}
              {activeTab === 'servicios' && (
                <ServiciosAdmin servicios={appData.servicios} ventas={appData.ventas} horas={appData.horas} config={appData.config} onSaveServicios={handleSaveServicios} formatCop={formatCop} />
              )}
              {activeTab === 'ajustes' && (
                <ConfigAdmin config={appData.config} ventas={appData.ventas} clientes={appData.clientes} horas={appData.horas} hasGoogleToken={!!getAccessToken()} lastSheetBackupLink={lastSheetBackupLink} isBackingUpToSheets={isBackingUpToSheets} onSaveConfig={handleSaveConfig} onBackupToSheets={handleBackupToSheets} onImportFromSheets={handleImportFromSheets} onImportFromSheetsUrl={handleImportFromSheetsUrl} formatCop={formatCop} />
              )}
              {activeTab === 'ventas-crm' && modules.crm_ventas && <CustomerCRM user={user} />}
              {isTeam && activeTab.startsWith('crm-') && (
                <AdminCRM user={user} embedded tab={activeTab.replace('crm-', '') as CRMTab} onTabChange={(t) => setActiveTab(`crm-${t}`)} />
              )}
            </>
          )}
        </div>
      </main>

        <AISidebar user={user} collapsed={aiCollapsed} onToggle={() => setAiCollapsed((v) => !v)} width={aiWidth} onResize={setAiWidth} currentArea={NAVIGATION_SECTIONS.find((section) => section.items.some((item) => item.id === activeTab))?.label} />

      </div>

      {/* 4. Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-[10px] font-mono text-slate-400 shrink-0 uppercase tracking-widest mt-12">
        Ferova OS © 2026 • Finanzas, Growth CRM y asistente IA con datos reales • <a href="/privacidad" className="underline hover:text-slate-700">Privacidad</a> • <a href="/terminos" className="underline hover:text-slate-700">Términos</a>
      </footer>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={handleNavigate}
        isTeam={isTeam}
        hasFinance={!!modules.financiero}
        onOpenAI={() => setAiCollapsed(false)}
        onOpenNotifications={() => handleNavigate('home')}
      />
    </div>
  );
}


import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { initAuth, googleSignIn, linkGoogleIdentity, logout, getAccessToken, resolveAccess, hydrateGoogleWorkspaceConnection } from './lib/supabase';
import { backupAppDataToSheets, importSheetByUrl } from './lib/sheetsService';
import * as financeService from './lib/financeService';
import { isTeamMember } from './lib/crmService';
import { getModules, PlanId } from './lib/planService';
import { getBusinessProfile, BusinessProfile } from './lib/businessProfileService';
import OnboardingChat from './components/OnboardingChat';
import FeedbackWidget from './components/FeedbackWidget';
import { Config, AppData, Cliente, Servicio, Herramienta, OtroGasto, Venta, Hora, PagoEgreso } from './types';
import { calcularMétricasFinancieras } from './lib/calculations';

// Unified Premium View Components
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
import AuthScreen from './components/AuthScreen';
import Paywall from './components/Paywall';
import AdminCRM, { CRMTab } from './components/AdminCRM';
import AISidebar from './components/AISidebar';
import CustomerCRM from './components/CustomerCRM';
import Home from './components/Home';
import SmartPlanner from './components/SmartPlanner';

import {
  Home as HomeIcon,
  LayoutGrid,
  FolderKanban,
  Settings as SettingsIcon,
  CalendarCheck,
  TrendingUp,
  Wallet,
  Users as UsersIcon,
  Briefcase,
  Clock as ClockIcon,
  Sparkles as SparklesIcon,
  MessageCircle,
  Linkedin,
  MessagesSquare,
  Star as StarIcon,
  Target as TargetIcon,
  User as UserIcon,
  LogOut,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const CRM_TAB_IDS: CRMTab[] = ['pipeline', 'citas', 'contenido', 'bot', 'resenas'];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [hasPaid, setHasPaid] = useState(false);
  const [isTeam, setIsTeam] = useState(false);
  const [plan, setPlan] = useState<PlanId>('financiero');
  const [checkingPayment, setCheckingPayment] = useState(false);
  const modules = React.useMemo(() => getModules(plan, isTeam), [plan, isTeam]);


  
  // Finance data state (Supabase)
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

  // Google Sheets backup (optional, manual)
  const [isBackingUpToSheets, setIsBackingUpToSheets] = useState(false);
  const [lastSheetBackupLink, setLastSheetBackupLink] = useState<string | null>(null);

  // Filter and view state
  const [selectedMonth, setSelectedMonth] = useState<string>('Todos');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [openGroup, setOpenGroup] = useState<string | null>('modules');
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
        setHasPaid(access.hasPaid || team);
        setPlan(access.plan);
        setIsTeam(team);
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
        hydrateGoogleWorkspaceConnection(userId),
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

  const metrics = isReady ? calcularMétricasFinancieras(appData, selectedMonth) : null;

  // Visual Tab Categorization - Separates Operational Management from Financial Control
  // Ambos bloques solo se muestran si el plan del cliente incluye el módulo Financiero.
  const GESTION_OPERATIVA_TABS = modules.financiero ? [
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
  const VENTAS_TABS = modules.crm_ventas ? [
    { id: 'ventas-crm', label: 'CRM y Ventas', hint: 'Tu pipeline propio' },
  ] : [];

  const CRM_GROWTH_TABS = isTeam ? [
    { id: 'crm-pipeline', label: 'Pipeline', hint: 'Prospectos y playbooks' },
    { id: 'crm-citas', label: 'Citas', hint: 'Diagnósticos y Calendar' },
    { id: 'crm-contenido', label: 'LinkedIn + Reddit', hint: 'Señales automáticas' },
    { id: 'crm-bot', label: 'Bot WhatsApp', hint: 'Conocimiento y estado' },
    { id: 'crm-resenas', label: 'Reseñas', hint: 'Gmail y fuentes' },
  ] : [];

  // Build the sidebar sections dynamically per role/plan.
  type NavItem = { id: string; label: string; icon: any };
  type NavGroup = { id: string; label: string; icon: any; items: NavItem[]; single?: boolean };

  const modulesGroup: NavItem[] = [];
  modulesGroup.push({ id: 'planner', label: 'Planificador', icon: CalendarCheck });
  modulesGroup.push({ id: 'proyectos', label: 'Proyectos', icon: FolderKanban });
  if (modules.financiero) {
    modulesGroup.push({ id: 'dashboard', label: 'Finanzas', icon: TrendingUp });
    modulesGroup.push({ id: 'ventas', label: 'Ingresos', icon: Wallet });
    modulesGroup.push({ id: 'pagosEgresos', label: 'Pagos', icon: Wallet });
    modulesGroup.push({ id: 'gastos', label: 'Costos', icon: Wallet });
    modulesGroup.push({ id: 'horas', label: 'Horas', icon: ClockIcon });
    modulesGroup.push({ id: 'clientes', label: 'Clientes', icon: UsersIcon });
    modulesGroup.push({ id: 'servicios', label: 'Servicios', icon: Briefcase });
    modulesGroup.push({ id: 'equilibrioGlobal', label: 'Equilibrio', icon: TargetIcon });
    modulesGroup.push({ id: 'equilibrioServicio', label: 'Equilibrio por servicio', icon: TargetIcon });
    modulesGroup.push({ id: 'iva', label: 'IVA', icon: Wallet });
    modulesGroup.push({ id: 'alertas', label: 'Alertas', icon: AlertCircle });
  }
  if (modules.crm_ventas) {
    modulesGroup.push({ id: 'ventas-crm', label: 'CRM y Ventas', icon: TargetIcon });
  }
  if (isTeam) {
    modulesGroup.push({ id: 'crm-pipeline', label: 'Pipeline (Growth)', icon: TargetIcon });
    modulesGroup.push({ id: 'crm-citas', label: 'Citas', icon: CalendarCheck });
    modulesGroup.push({ id: 'crm-contenido', label: 'LinkedIn + Reddit', icon: Linkedin });
    modulesGroup.push({ id: 'crm-bot', label: 'Bot WhatsApp', icon: MessageCircle });
    modulesGroup.push({ id: 'crm-resenas', label: 'Reseñas', icon: StarIcon });
  }

  const navGroups: NavGroup[] = [
    { id: 'home', label: 'Home', icon: HomeIcon, items: [], single: true },
    { id: 'modules', label: 'Módulos', icon: LayoutGrid, items: modulesGroup },
    { id: 'settings', label: 'Ajustes', icon: SettingsIcon, items: modules.financiero ? [{ id: 'ajustes', label: 'Configuración', icon: SettingsIcon }] : [] },
  ];

  const handleNavigate = (tab: string) => {
    if (tab === '__ai') { setAiCollapsed(false); return; }
    setActiveTab(tab);
  };

  const userName = (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || (user.email || '').split('@')[0];

  return (
    <div className="ferova-light-theme min-h-screen bg-[var(--bg)] flex text-[var(--text)] font-sans">
      {/* LEFT NAV RAIL */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-[var(--line)] bg-white">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--line)]">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white font-bold shadow-sm">F</div>
          <div>
            <p className="text-sm font-semibold text-slate-900 font-display leading-tight">Ferova OS</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">Tu negocio</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navGroups.map((g) => {
            const GIcon = g.icon;
            if (g.single) {
              const active = activeTab === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => handleNavigate(g.id)}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  <GIcon className="h-4 w-4" /> {g.label}
                </button>
              );
            }
            if (g.items.length === 0) return null;
            const isOpen = openGroup === g.id;
            const anyActive = g.items.some((i) => i.id === activeTab || (i.id.startsWith('crm-') && activeTab === i.id));
            return (
              <div key={g.id}>
                <button
                  onClick={() => setOpenGroup(isOpen ? null : g.id)}
                  className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${anyActive ? 'text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <span className="flex items-center gap-2.5"><GIcon className="h-4 w-4" /> {g.label}</span>
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                </button>
                {isOpen && (
                  <div className="mt-1 ml-2 pl-3 border-l border-[var(--line)] space-y-0.5">
                    {g.items.map((item) => {
                      const IIcon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavigate(item.id)}
                          className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition ${active ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                        >
                          <IIcon className="h-3.5 w-3.5" /> <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[var(--line)] p-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white border border-[var(--line)] text-slate-600">
              <UserIcon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{userName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
            <button onClick={handleSignOut} className="text-slate-400 hover:text-red-600 p-1" title="Cerrar sesión">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
          {!isTeam && <div className="mt-2"><FeedbackWidget user={user} /></div>}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0 overflow-y-auto">
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
              {activeTab === 'home' && (
                <Home appData={appData} formatCop={formatCop} onNavigate={handleNavigate} userName={userName} />
              )}
              {activeTab === 'planner' && <SmartPlanner />}
              {activeTab === 'dashboard' && (
                <Dashboard data={appData} metrics={metrics} selectedMonth={selectedMonth} formatCop={formatCop} formatUsd={formatUsd} />
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
                <ProyectosAdmin clientes={appData.clientes} config={appData.config} onSaveClientes={handleSaveClientes} />
              )}
              {activeTab === 'pagosEgresos' && (
                <PagosEgresosAdmin pagosEgresos={appData.pagosEgresos || []} config={appData.config} onSavePagosEgresos={handleSavePagosEgresos} />
              )}
              {activeTab === 'gastos' && (
                <GastosAdmin herramientas={appData.herramientas} otrosGastos={appData.otrosGastos} servicios={appData.servicios} clientes={appData.clientes} config={appData.config} onSaveHerramientas={handleSaveHerramientas} onSaveOtrosGastos={handleSaveOtrosGastos} onSaveConfig={handleSaveConfig} formatCop={formatCop} formatUsd={formatUsd} />
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

      {/* RIGHT AI SIDEBAR */}
      <AISidebar user={user} collapsed={aiCollapsed} onToggle={() => setAiCollapsed((v) => !v)} width={aiWidth} onResize={setAiWidth} />
    </div>
  );
}


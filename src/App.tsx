import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { initAuth, googleSignIn, linkGoogleIdentity, logout, getAccessToken, checkSubscription } from './lib/supabase';
import { backupAppDataToSheets, importSheetByUrl } from './lib/sheetsService';
import * as financeService from './lib/financeService';
import { isTeamMember } from './lib/crmService';
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


import { 
  Building2, 
  User as UserIcon, 
  LogOut, 
  Database, 
  Calendar, 
  Loader2, 
  AlertCircle,
  Menu,
  X
} from 'lucide-react';

const CRM_TAB_IDS: CRMTab[] = ['pipeline', 'citas', 'contenido', 'bot'];

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

  // Import from a Google Sheet by pasting its URL. Uses backend edge function that reads
  // the public CSV export (sheet must be shared as "Anyone with the link can view").
  const handleImportFromSheetsUrl = async (rawUrl: string) => {
    if (!user) return;
    const url = (rawUrl || '').trim();
    if (!url) { alert('Pega el link de tu Google Sheet.'); return; }
    if (!confirm('Esto reemplazará tus datos actuales con los de la hoja indicada. ¿Continuar?')) return;
    setSheetsLoading(true);
    try {
      const data = await importSheetByUrl(url);
      await Promise.all([
        financeService.saveConfig(user.id, data.config),
        financeService.saveClientes(user.id, data.clientes),
        financeService.saveServicios(user.id, data.servicios),
        financeService.saveHerramientas(user.id, data.herramientas),
        financeService.saveOtrosGastos(user.id, data.otrosGastos),
        financeService.savePagosEgresos(user.id, data.pagosEgresos || []),
        financeService.saveVentas(user.id, data.ventas),
        financeService.saveHoras(user.id, data.horas),
      ]);
      const fresh = await financeService.loadFinanceData(user.id);
      setAppData(fresh);
      alert('✨ Importación completada.');
    } catch (err: any) {
      alert(`Fallo al importar: ${err.message || err}\n\nAsegúrate de:\n1) Compartir la hoja con "Cualquier persona con el link puede ver".\n2) Que tenga las pestañas: Config, Clientes, Servicios, Herramientas, OtrosGastos, Ventas, Horas, PagosEgresos.`);
    } finally {
      setSheetsLoading(false);
    }
  };

  // Deprecated (dejado para compatibilidad con el botón "Importar mi Google Sheet" existente):
  // ahora redirige al flujo del link.
  const handleImportFromSheets = async () => {
    alert('Pega el link de tu Google Sheet en el campo de abajo — asegurate de que esté compartida como "Cualquier persona con el link puede ver".');
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
        <div className="min-h-screen bg-[#0f0e0c] flex items-center justify-center text-[#e8e3d8]">
          <Loader2 className="w-8 h-8 animate-spin text-[#c9a961]" />
        </div>
      );
    }
    if (!user) return <AuthScreen />;
    return <AdminCRM user={user} />;
  }

  if (authLoading || checkingPayment) {
    return (
      <div className="min-h-screen bg-[#0f0e0c] flex items-center justify-center text-[#e8e3d8]">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#c9a961] mx-auto" />
          <p className="text-xs font-semibold font-mono tracking-widest text-[#a39d8e]">
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
    { id: 'proyectos', label: '1. Operativo (Proyectos y KPIs)' },
    { id: 'horas', label: '2. Control de Horas' },
    { id: 'clientes', label: '3. Clientes' },
    { id: 'servicios', label: '4. Servicios' }
  ];

  const GESTION_FINANCIERA_TABS = [
    { id: 'dashboard', label: '5. Dashboard' },
    { id: 'ventas', label: '6. Ingresos (Ventas y Abonos)' },
    { id: 'pagosEgresos', label: '7. Registro de Pagos (Egresos)' },
    { id: 'gastos', label: '8. Costos y Gastos' },
    { id: 'equilibrioGlobal', label: '9. Equilibrio Global' },
    { id: 'equilibrioServicio', label: '10. Equilibrio de Servicio' },
    { id: 'iva', label: '11. Control de IVA' },
    { id: 'alertas', label: '12. Alertas' },
    { id: 'ajustes', label: '13. Base de Datos / Ajustes' }
  ];

  const CRM_GROWTH_TABS = isTeam ? [
    { id: 'crm-pipeline', label: '↗ Pipeline de Ventas' },
    { id: 'crm-citas', label: '↗ Citas + Calendar' },
    { id: 'crm-contenido', label: '↗ LinkedIn + Reddit' },
    { id: 'crm-bot', label: '↗ Bot WhatsApp' },
  ] : [];

  const TAB_SET = [...GESTION_OPERATIVA_TABS, ...GESTION_FINANCIERA_TABS, ...CRM_GROWTH_TABS];

  return (
    <div className="min-h-screen bg-[#0f0e0c] bg-gradient-to-br from-[#0f0e0c] to-[#1a1815] flex flex-col text-[#e8e3d8] font-sans">
      
      {/* 1. Header component */}
      <header className="bg-[#11100e] border-b border-[#2a2620] relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#c9a961]/10 border border-[#c9a961]/25 flex items-center justify-center text-[#c9a961] shadow-inner font-bold">
              F
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-normal font-bold font-display tracking-tight text-white">Ferova OS</h1>
                <span className="text-[9px] bg-[#c9a961]/10 border border-[#c9a961]/35 font-mono text-[#c9a961] px-1.5 py-0.2 rounded font-semibold">
                  2026 CONTABILIDAD
                </span>
              </div>
              <span className="text-[10px] text-[#a39d8e] font-mono block mt-0.5 uppercase tracking-wider">
                Ferova Agency • Bogotá, CO
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            
            {/* 1.1 TRM Editable Quick Panel */}
            {isReady && appData && (
              <div className="hidden md:flex items-center gap-2 bg-[#161412] px-3 py-1.5 rounded border border-[#2a2620] text-xs font-mono">
                <span className="text-[#8a8377] uppercase text-[10px] tracking-wider">TRM:</span>
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
                      className="w-16 bg-[#0f0e0c] text-white border border-[#2a2620] p-0.5 px-1 rounded text-xs font-mono focus:outline-none focus:border-[#c9a961]"
                      autoFocus
                    />
                    <button 
                      type="submit" 
                      className="text-emerald-500 hover:text-emerald-400 font-bold px-1 cursor-pointer"
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
                    <span className="text-[#c9a961] font-bold">{formatCop(appData.config.trm)}</span>
                    <button 
                      onClick={() => setIsEditingTrm(true)}
                      className="text-[#8a8377] hover:text-[#e8e3d8] text-[9px] hover:underline cursor-pointer"
                    >
                      [✏️]
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 1.2 Display de Clientes Activos */}
            {isReady && appData && (
              <div className="hidden sm:flex items-center gap-2 bg-[#161412] px-3 py-1.5 rounded border border-[#2a2620] text-xs font-mono text-[#a39d8e]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#a8c98a] animate-pulse" />
                <span>
                  CLIENTES: <strong className="text-white">{appData.clientes.filter(c => c.activo).length}</strong>
                </span>
              </div>
            )}
            
            {/* Google Sheets backup link, if one exists */}
            {lastSheetBackupLink && (
              <a
                href={lastSheetBackupLink}
                target="_blank"
                rel="noreferrer"
                className="bg-[#1c1916] hover:bg-[#23201c] transition px-3 py-1.5 rounded border border-[#2a2620] text-xs font-mono text-[#a39d8e] flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Respaldo en Sheets</span>
              </a>
            )}

            {/* Profile component user info */}
            <div className="flex items-center gap-2.5 bg-[#161412] p-1.5 pr-3.5 rounded border border-[#2a2620]">
              <div className="w-7 h-7 bg-[#c9a961]/15 rounded-full border border-[#c9a961]/30 flex items-center justify-center">
                <UserIcon className="w-3.5 h-3.5 text-[#c9a961]" />
              </div>
              <div className="hidden md:block text-left text-[10px] leading-tight">
                <span className="font-semibold text-white block">{(user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || 'Mafe'}</span>
                <span className="text-[#8a8377] block font-mono text-[9px] max-w-28 truncate">{user.email}</span>
              </div>
              
              <button 
                onClick={handleSignOut}
                className="bg-[#0f0e0c]/60 p-1.5 rounded border border-[#2a2620] text-[#8a8377] hover:text-[#c97a61] cursor-pointer transition ml-1"
                title="Cerrar sesion Workspace"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile menu trigger */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden bg-[#161412] border border-[#2a2620] p-2 rounded text-[#a39d8e]"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>

        </div>
      </header>

      {/* Sync Banner */}
      {sheetsLoading && (
        <div className="bg-[#c9a961]/10 border-b border-[#c9a961]/15 text-[#c9a961] py-2 text-center text-[10px] font-mono font-semibold uppercase tracking-wider flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Sincronizando base de datos en Google Sheets...</span>
        </div>
      )}

      {/* 2. Global Period Selection Rail */}
      {isReady && appData && (
        <div className="bg-[#11100e] border-b border-[#2a2620] py-3 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#c9a961]" />
              <span className="font-mono text-[#a39d8e] text-[10px] uppercase font-bold tracking-wider">Ventana Periodo DIAN:</span>
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-[#0f0e0c] text-white border border-[#2a2620] text-xs p-1 rounded font-mono focus:outline-none focus:border-[#c9a961]"
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
              <div className="flex items-center gap-4 text-[10px] font-mono tracking-wider text-[#a39d8e]">
                <div>
                  <span>FACTURACIÓN:</span> <strong className="text-white">{formatCop(metrics.totalVentas)}</strong>
                </div>
                <div className="w-px h-3 bg-[#2a2620]" />
                <div>
                  <span>NÓMINA RETIROS:</span> <strong className="text-white">{formatCop(metrics.salarioPropuesto)}</strong>
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
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        
        {/* Navigation Sidebar menu (lg+) */}
        <aside className="lg:w-56 shrink-0 space-y-5 hidden lg:block select-none">
          
          <div>
            <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-[#c9a961] block px-3 mb-2 font-black border-l-2 border-l-[#c9a961] pl-2">
              Gestión Operativa
            </span>
            <nav className="space-y-1 text-xs font-mono font-semibold">
              {GESTION_OPERATIVA_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-3.5 py-2 rounded transition ${
                    activeTab === tab.id 
                      ? 'bg-[#c9a961]/10 text-[#c9a961] border-l-3 border-l-[#c9a961] font-semibold' 
                      : 'text-[#a39d8e] hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="pt-2 border-t border-[#2a2620]/45">
            <span className="text-[10px] uppercase font-mono tracking-[0.2em] text-[#a39d8e] block px-3 mb-2 font-black border-l-2 border-l-[#a39d8e] pl-2">
              Control Financiero
            </span>
            <nav className="space-y-1 text-xs font-mono font-semibold">
              {GESTION_FINANCIERA_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-3.5 py-2 rounded transition ${
                    activeTab === tab.id 
                      ? 'bg-[#c9a961]/10 text-[#c9a961] border-l-3 border-l-[#c9a961] font-semibold' 
                      : 'text-[#a39d8e] hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

        </aside>

        {/* Responsive Mobile Drawer menu (controlled by trigger button) */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-35 bg-black/80 flex justify-end" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="w-64 bg-[#11100e] border-l border-[#2a2620] h-full p-5 space-y-4 text-xs font-mono overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-[#2a2620] pb-3 mb-2">
                <span className="font-semibold text-[#c9a961]">Menú Corporativo</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-[#8a8377]">Cerrar</button>
              </div>
              
              <div className="space-y-4 text-left">
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-[#c9a961]/70 block font-bold mb-1.5 font-mono">1. GESTIÓN OPERATIVA</span>
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
                            ? 'bg-[#c9a961]/10 text-[#c9a961] font-semibold' 
                            : 'text-[#a39d8e] hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>

                <div className="pt-2 border-t border-[#2a2620]/45">
                  <span className="text-[9px] uppercase tracking-wider text-[#a39d8e]/70 block font-bold mb-1.5 font-mono">2. CONTROL FINANCIERO</span>
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
                            ? 'bg-[#c9a961]/10 text-[#c9a961] font-semibold' 
                            : 'text-[#a39d8e] hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Content body layout container */}
        <div className="flex-1 min-w-0">
          
          {/* Error alerts */}
          {errorMsg && (
            <div className="bg-[#c97a61]/10 border border-[#c97a61]/25 rounded p-4 flex gap-3 text-xs text-[#e8e3d8] mb-6">
              <AlertCircle className="w-5 h-5 text-[#c97a61] shrink-0 mt-0.5" />
              <div className="space-y-1.5 w-full">
                <span className="font-semibold font-display text-[#c97a61] block">Inconveniente de Sincronización</span>
                <p className="text-[#a39d8e] leading-relaxed">{errorMsg}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-[#c97a61]/15 mt-2 items-center">
                  <button
                    onClick={() => user && bootstrapFinanceData(user.id)}
                    className="underline text-white font-mono font-bold hover:text-[#c9a961] cursor-pointer"
                  >
                    Intentar reconexión manual
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="underline text-[#a39d8e] font-mono hover:text-white cursor-pointer"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Load databases spinner */}
          {!isReady && !errorMsg && (
            <div className="bg-[#161412] border border-[#2a2620] rounded-lg p-16 text-center text-xs space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#c9a961] mx-auto" />
              <p className="font-mono text-[#a39d8e] font-semibold tracking-wider">CARGANDO TU CONTABILIDAD...</p>
              <p className="text-[#8a8377] max-w-sm mx-auto leading-relaxed">
                Sincronizando clientes, ventas y parámetros DIAN 2026 desde tu cuenta.
              </p>
            </div>
          )}

          {/* ACTIVE SCREEN ROUTER FRAMEWORK */}
          {isReady && metrics && appData && (
            <div className="min-h-[500px]">
              
              {activeTab === 'dashboard' && (
                <Dashboard 
                  data={appData} 
                  metrics={metrics} 
                  selectedMonth={selectedMonth} 
                  formatCop={formatCop} 
                  formatUsd={formatUsd} 
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
                  clientes={appData.clientes}
                  config={appData.config}
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

            </div>
          )}

        </div>

      </div>

      {/* 4. Footer */}
      <footer className="bg-[#11100e] border-t border-[#2a2620] py-6 text-center text-[10px] font-mono text-[#8a8377] shrink-0 uppercase tracking-widest mt-12">
        Ferova OS © 2026 • Diseñado con geometría nocturna • Sincronización activa Google Workspace
      </footer>

    </div>
  );
}

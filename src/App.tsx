import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/firebase';
import { 
  findSpreadsheet, 
  createSpreadsheet, 
  fetchSpreadsheetData, 
  saveSheetTable, 
  updateConfigInSheet, 
  createDriveBackup,
  seedSpreadsheet,
  restoreFromBackup,
  searchAllRelatedSpreadsheets,
  untrashSpreadsheet,
  DriveFileInfo
} from './lib/sheetsService';
import { Config, AppData, Cliente, Servicio, Herramienta, OtroGasto, Venta, Hora, Respaldo, PagoEgreso } from './types';
import { calcularMétricasFinancieras, getUniqueSalesMonths } from './lib/calculations';

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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Sheet State
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetLink, setSpreadsheetLink] = useState<string | null>(null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recovery Engine State
  const [relatedSheets, setRelatedSheets] = useState<DriveFileInfo[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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
    // Listen for Auth events
    const unsubscribe = initAuth(
      (fUser) => {
        setUser(fUser);
        setAuthLoading(false);
        if (fUser) {
          bootstrapSheets();
        }
      },
      () => {
        setUser(null);
        setAuthLoading(false);
        setSpreadsheetId(null);
        setSpreadsheetLink(null);
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

  // Safe fetch trigger on login / refresh
  const bootstrapSheets = async () => {
    const token = getAccessToken();
    if (!token) {
      setErrorMsg('No se pudo recuperar el token de Google Sheets.');
      return;
    }

    setSheetsLoading(true);
    setErrorMsg(null);
    try {
      // First check if user connected a custom Spreadsheet ID in prior session
      let sheetId = localStorage.getItem('ferova_custom_spreadsheet_id') || null;
      let sheetLink = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : null;

      if (!sheetId) {
        // Find or Create Sheet
        const result = await findSpreadsheet(token);
        sheetId = result?.id || null;
        sheetLink = result?.webViewLink || null;
      }

      if (!sheetId) {
        sheetId = await createSpreadsheet(token);
        sheetLink = `https://docs.google.com/spreadsheets/d/${sheetId}`;
        // Automatically seed the brand new sheet so it is populated with default structures and variables
        await seedSpreadsheet(sheetId, token);
      }

      setSpreadsheetId(sheetId);
      setSpreadsheetLink(sheetLink || null);

      // Load all data
      const data = await fetchSpreadsheetData(sheetId, token);
      setAppData(data);
    } catch (err: any) {
      console.error('Sheets bootstrap error:', err);
      if (err.message === 'UNAUTHORIZED') {
        setErrorMsg('Tu sesión de Google expiró. Por favor cierra sesión y vuelve a ingresar.');
      } else {
        setErrorMsg(`Error al montar Google Sheet: ${err.message || err}. ¿Es posible que se haya eliminado, que no tenga el formato correcto o que requiera permisos de acceso?`);
      }
    } finally {
      setSheetsLoading(false);
    }
  };

  const extractSpreadsheetId = (input: string): string => {
    const trimmed = input.trim();
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  };

  const handleConnectCustomSheet = async (urlOrId: string) => {
    const id = extractSpreadsheetId(urlOrId);
    if (!id) {
      alert('Enlace o ID de planilla no válido.');
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setErrorMsg('No se pudo recuperar el token de Google Sheets.');
      return;
    }

    setSheetsLoading(true);
    setErrorMsg(null);
    try {
      // Fetch data from the specifically entered spreadsheet to test access and correct sheet structure
      const data = await fetchSpreadsheetData(id, token);
      
      // Save correct preference
      localStorage.setItem('ferova_custom_spreadsheet_id', id);
      setSpreadsheetId(id);
      setSpreadsheetLink(`https://docs.google.com/spreadsheets/d/${id}`);
      setAppData(data);
      alert('✨ ¡Planilla conectada correctamente! Se sincronizaron exitosamente todos tus datos históricos de Ferova.');
    } catch (err: any) {
      console.error('Error connecting custom sheet:', err);
      alert(`No se pudo cargar la planilla seleccionada. Asegúrate de que:\n1. Tienes acceso de edición a esta hoja en Google Drive.\n2. La hoja posee las pestañas correspondientes de control (Config, Clientes, Servicios, etc.).\n\nDetalle del error: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleForceCreateNewDatabase = async () => {
    const token = getAccessToken();
    if (!token) {
      setErrorMsg('No se pudo recuperar el token de Google Sheets para crear la planilla.');
      return;
    }

    const confirm = window.confirm(
      '⚠️ ATENCIÓN: ¿Estás seguro que deseas forzar la creación de una NUEVA planilla ("Ferova_OS_Financiero") en tu Google Drive?\n\n' +
      'Usa esta opción si eliminaste el archivo original, si vaciaste la papelera o si el archivo está corrupto. Se inicializará con datos base limpia y parámetros DIAN 2026.'
    );
    if (!confirm) return;

    setSheetsLoading(true);
    setErrorMsg(null);
    try {
      const sheetId = await createSpreadsheet(token);
      const sheetLink = `https://docs.google.com/spreadsheets/d/${sheetId}`;
      
      // Seed default values immediately
      await seedSpreadsheet(sheetId, token);
      
      setSpreadsheetId(sheetId);
      setSpreadsheetLink(sheetLink || null);

      // Load all data
      const data = await fetchSpreadsheetData(sheetId, token);
      setAppData(data);
      alert('✨ ¡Planilla creada e inicializada con éxito en tu Google Drive! Ya puedes usar el sistema de forma normal.');
    } catch (err: any) {
      console.error('Error forcing sheet creation:', err);
      setErrorMsg(`Error al forzar la creación de la planilla: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSearchDriveForSheets = async () => {
    const token = getAccessToken();
    if (!token) {
      setSearchError('No se pudo recuperar el token de Google.');
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const files = await searchAllRelatedSpreadsheets(token);
      setRelatedSheets(files);
      if (files.length === 0) {
        setSearchError('No se encontraron planillas con el nombre "Ferova_OS_Financiero" en tu unidad de Google Drive (ni en la Papelera).');
      }
    } catch (err: any) {
      console.error('Error searching drive:', err);
      setSearchError(`Error buscando en Google Drive: ${err.message || err}`);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleConnectSheet = async (fileId: string, fileName: string, isTrashed: boolean) => {
    const token = getAccessToken();
    if (!token) {
      alert('Error: No se pudo obtener la sesión o token de Google.');
      return;
    }

    const confirmMsg = isTrashed
      ? `La planilla "${fileName}" se encuentra en tu PAPELERA de Google Drive.\n\n¿Quieres que la restauremos automáticamente a tu unidad principal y la conectemos para recuperar tus datos?`
      : `¿Estás seguro que deseas conectar la planilla "${fileName}" y sincronizar sus datos históricos?`;

    if (!window.confirm(confirmMsg)) return;

    setSheetsLoading(true);
    setErrorMsg(null);
    try {
      if (isTrashed) {
        await untrashSpreadsheet(token, fileId);
      }

      localStorage.setItem('ferova_custom_spreadsheet_id', fileId);
      setSpreadsheetId(fileId);
      const link = `https://docs.google.com/spreadsheets/d/${fileId}`;
      setSpreadsheetLink(link);

      // Load all data
      const data = await fetchSpreadsheetData(fileId, token);
      setAppData(data);
      alert(`✨ ¡Conexión exitosa! Los datos de la planilla "${fileName}" han sido restaurados con éxito.`);
      setRelatedSheets([]);
    } catch (err: any) {
      console.error('Error connecting spreadsheet:', err);
      setErrorMsg(`Error al conectar con la planilla seleccionada: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  // --- PERSISTENCE HANDLERS ---
  const handleSaveClientes = async (updatedClientes: Cliente[]) => {
    if (!spreadsheetId || !appData) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      const headers = ['id', 'nombre', 'tipo', 'declarante', 'activo', 'fecha_creacion', 'notas', 'marca_info', 'objetivos', 'kpis', 'entregables', 'progreso', 'responsable'];
      const rows = updatedClientes.map(c => [
        c.id,
        c.nombre,
        c.tipo,
        c.declarante ? 'TRUE' : 'FALSE',
        c.activo ? 'TRUE' : 'FALSE',
        c.fecha_creacion,
        c.notas || '',
        c.marca_info || '',
        c.objetivos || '',
        c.kpis || '',
        c.entregables || '',
        c.progreso || 0,
        c.responsable || ''
      ]);

      await saveSheetTable(spreadsheetId, token, 'Clientes', headers, rows);
      setAppData({ ...appData, clientes: updatedClientes });
    } catch (err: any) {
      alert(`Error en Google Sheets: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveServicios = async (updatedServicios: Servicio[]) => {
    if (!spreadsheetId || !appData) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      const headers = ['id', 'nombre', 'costo_unitario', 'descripcion'];
      const rows = updatedServicios.map(s => [
        s.id,
        s.nombre,
        s.costo_unitario,
        s.descripcion || ''
      ]);

      await saveSheetTable(spreadsheetId, token, 'Servicios', headers, rows);
      setAppData({ ...appData, servicios: updatedServicios });
    } catch (err: any) {
      alert(`Error en Google Sheets: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveHerramientas = async (updatedHerramientas: Herramienta[]) => {
    if (!spreadsheetId || !appData) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      const headers = ['id', 'nombre', 'monto', 'moneda', 'tipo_cobro', 'servicios_ids', 'notas'];
      const rows = updatedHerramientas.map(h => [
        h.id,
        h.nombre,
        h.monto,
        h.moneda,
        h.tipo_cobro,
        h.servicios_ids || '',
        h.notas || ''
      ]);

      await saveSheetTable(spreadsheetId, token, 'Herramientas', headers, rows);
      setAppData({ ...appData, herramientas: updatedHerramientas });
    } catch (err: any) {
      alert(`Error en Google Sheets: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveOtrosGastos = async (updatedGastos: OtroGasto[]) => {
    if (!spreadsheetId || !appData) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      const headers = ['id', 'nombre', 'monto', 'moneda', 'categoria'];
      const rows = updatedGastos.map(g => [
        g.id,
        g.nombre,
        g.monto,
        g.moneda,
        g.categoria
      ]);

      await saveSheetTable(spreadsheetId, token, 'OtrosGastos', headers, rows);
      setAppData({ ...appData, otrosGastos: updatedGastos });
    } catch (err: any) {
      alert(`Error en Google Sheets: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSavePagosEgresos = async (updatedPagos: PagoEgreso[]) => {
    if (!spreadsheetId || !appData) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      const headers = ['id', 'fecha', 'concepto', 'categoria', 'monto', 'moneda', 'metodo_pago', 'notas'];
      const rows = updatedPagos.map(p => [
        p.id,
        p.fecha,
        p.concepto,
        p.categoria,
        p.monto,
        p.moneda,
        p.metodo_pago,
        p.notas || ''
      ]);

      await saveSheetTable(spreadsheetId, token, 'PagosEgresos', headers, rows);
      setAppData({ ...appData, pagosEgresos: updatedPagos });
    } catch (err: any) {
      alert(`Error en Google Sheets: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveVentas = async (updatedVentas: Venta[]) => {
    if (!spreadsheetId || !appData) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      const headers = [
        'id', 'fecha', 'cliente_id', 'cliente_nombre', 'servicio_id', 'servicio_nombre',
        'cantidad', 'precio_venta_unitario', 'costo_unitario', 'moneda', 'tipo', 'adelanto', 'estado_pago', 'notas', 'abonos_log'
      ];
      const rows = updatedVentas.map(v => [
        v.id,
        v.fecha,
        v.cliente_id,
        v.cliente_nombre,
        v.servicio_id,
        v.servicio_nombre,
        v.cantidad,
        v.precio_venta_unitario,
        v.costo_unitario,
        v.moneda,
        v.tipo,
        v.adelanto,
        v.estado_pago,
        v.notas || '',
        JSON.stringify(v.abonos || [])
      ]);

      await saveSheetTable(spreadsheetId, token, 'Ventas', headers, rows);
      setAppData({ ...appData, ventas: updatedVentas });
    } catch (err: any) {
      alert(`Error en Google Sheets: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveHoras = async (updatedHoras: Hora[]) => {
    if (!spreadsheetId || !appData) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      const headers = ['id', 'fecha', 'cliente_id', 'cliente_nombre', 'servicio_id', 'servicio_nombre', 'horas', 'descripcion'];
      const rows = updatedHoras.map(h => [
        h.id,
        h.fecha,
        h.cliente_id,
        h.cliente_nombre,
        h.servicio_id,
        h.servicio_nombre,
        h.horas,
        h.descripcion
      ]);

      await saveSheetTable(spreadsheetId, token, 'Horas', headers, rows);
      setAppData({ ...appData, horas: updatedHoras });
    } catch (err: any) {
      alert(`Error en Google Sheets: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleSaveConfig = async (updatedConfig: Partial<Config>) => {
    if (!spreadsheetId || !appData) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      const fullConfig = { ...appData.config, ...updatedConfig };
      await updateConfigInSheet(spreadsheetId, token, fullConfig);
      setAppData({ ...appData, config: fullConfig });
    } catch (err: any) {
      alert(`Error actualizando constantes: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    if (!spreadsheetId || !appData || !user?.email) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      const result = await createDriveBackup(spreadsheetId, token, user.email, appData.respaldos);
      
      const newBackupRow: Respaldo = {
        fecha: result.date,
        usuario: user.email,
        snapshot_drive_id: result.snapshotId
      };

      const updatedRespaldos = [...appData.respaldos, newBackupRow];
      setAppData({
        ...appData,
        respaldos: updatedRespaldos
      });
    } catch (err: any) {
      alert(`Error creando copia de respaldo: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleWipeDatabase = async () => {
    if (!spreadsheetId) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      await seedSpreadsheet(spreadsheetId, token);
      const data = await fetchSpreadsheetData(spreadsheetId, token);
      setAppData(data);
      alert('✨ Base de datos reiniciada con éxito. Se pre-cargaron los parámetros de ley 2026.');
    } catch (err: any) {
      alert(`Error borrando los datos: ${err.message || err}`);
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!spreadsheetId) return;
    const token = getAccessToken();
    if (!token) return;

    setSheetsLoading(true);
    try {
      const data = await restoreFromBackup(spreadsheetId, backupId, token);
      setAppData(data);
      alert('✨ Base de datos restaurada correctamente desde el respaldo.');
    } catch (err: any) {
      alert(`Error restaurando el respaldo: ${err.message || err}`);
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f0e0c] flex items-center justify-center text-[#e8e3d8]">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#c9a961] mx-auto" />
          <p className="text-xs font-semibold font-mono tracking-widest text-[#a39d8e]">AUTENTICANDO SESIÓN...</p>
        </div>
      </div>
    );
  }

  // Auth check fallback
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f0e0c] flex flex-col justify-center items-center p-4 text-[#e8e3d8] font-sans">
        <div className="max-w-md w-full bg-[#161412] border border-[#2a2620] rounded-lg p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[3px] bg-[#c9a961]" />
          
          <div className="space-y-2.5">
            <h1 className="text-2xl font-bold font-display tracking-tight text-[#c9a961]">Ferova OS Financiero</h1>
            <p className="text-xs text-[#a39d8e] font-mono uppercase tracking-wider">
              Control Ejecutivo y Tránsito DIAN 2026
            </p>
          </div>

          <p className="text-xs text-[#8a8377] leading-relaxed border-t border-b border-[#2a2620] py-4">
            Este software autónomo utiliza Google Sheets como base de datos viva e interactúa con Google Drive para resguardar copias seguras de la agencia. Identifícate con tu cuenta autorizada para conceder privilegios API.
          </p>

          <div className="pt-2">
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-neutral-100 text-black font-semibold font-sans py-3 rounded-md transition cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24.5 12 .5c-4.7 0-8.75 2.69-10.72 6.61l3.99 3.09C6.21 7.15 8.87 5.04 12 5.04z" />
                <path fill="#4285F4" d="M23.25 12c0-.78-.07-1.62-.23-2.39H12v4.52h6.38c-.28 1.47-1.11 2.7-2.35 3.53l3.65 2.83c2.13-1.97 3.57-4.87 3.57-8.49z" />
                <path fill="#FBBC05" d="M5.27 14.3c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.28 6.61C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.09z" />
                <path fill="#34A853" d="M12 23.5c3.24 0 5.96-1.07 7.94-2.91l-3.65-2.83c-1.04.7-2.38 1.11-4.29 1.11-3.13 0-5.79-2.11-6.74-5.2l-3.99 3.09C3.25 20.81 7.3 23.5 12 23.5z" />
              </svg>
              <span>Autenticar con Google Workspace</span>
            </button>
          </div>

          <p className="text-[10px] text-[#8a8377] font-mono pt-2">Mafe © 2026 | Bogotá D.C., Colombia</p>
        </div>
      </div>
    );
  }

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

  const TAB_SET = [...GESTION_OPERATIVA_TABS, ...GESTION_FINANCIERA_TABS];

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
            
            {/* Database Linked Button inside workspace */}
            {spreadsheetId && (
              <a 
                href={spreadsheetLink || '#'} 
                target="_blank" 
                rel="noreferrer"
                className="bg-[#1c1916] hover:bg-[#23201c] transition px-3 py-1.5 rounded border border-[#2a2620] text-xs font-mono text-[#a39d8e] flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Google Sheet Directo</span>
              </a>
            )}

            {/* Profile component user info */}
            <div className="flex items-center gap-2.5 bg-[#161412] p-1.5 pr-3.5 rounded border border-[#2a2620]">
              <div className="w-7 h-7 bg-[#c9a961]/15 rounded-full border border-[#c9a961]/30 flex items-center justify-center">
                <UserIcon className="w-3.5 h-3.5 text-[#c9a961]" />
              </div>
              <div className="hidden md:block text-left text-[10px] leading-tight">
                <span className="font-semibold text-white block">{user.displayName || 'Mafe'}</span>
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
                    onClick={bootstrapSheets}
                    className="underline text-white font-mono font-bold hover:text-[#c9a961] cursor-pointer"
                  >
                    Intentar reconexión manual
                  </button>
                  <button 
                    onClick={handleLogin}
                    className="underline text-[#c9a961] font-mono font-bold hover:text-white cursor-pointer"
                  >
                    Volver a Autenticar con Google
                  </button>
                  <button 
                    onClick={handleForceCreateNewDatabase}
                    className="px-2.5 py-1 rounded bg-[#c9a961]/15 border border-[#c9a961]/35 text-[#c9a961] font-mono font-bold hover:bg-[#c9a961]/25 cursor-pointer text-[11px] transition-all"
                  >
                    🛠️ ¿Borraste la planilla? Crear una NUEVA limpia
                  </button>
                  <button 
                    onClick={handleSignOut}
                    className="underline text-[#a39d8e] font-mono hover:text-white cursor-pointer"
                  >
                    Cerrar sesión
                  </button>
                </div>

                {/* Google Drive Sheet Recovery sub-component */}
                <div className="mt-4 pt-4 border-t border-[#c97a61]/20">
                  <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                    <div>
                      <h4 className="font-semibold text-white text-[11px] font-mono uppercase tracking-wider">
                        🔍 Recuperador Antirrobo y de Planillas en Drive
                      </h4>
                      <p className="text-[#a39d8e] text-[10px] mt-0.5 leading-relaxed">
                        ¿Borraste tu archivo sin querer o quieres volver a conectar una versión anterior? Podemos buscarlo en tu Papelera de Google Drive o entre tus respaldos.
                      </p>
                    </div>
                    {!searchLoading && relatedSheets.length === 0 && (
                      <button
                        onClick={handleSearchDriveForSheets}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 active:bg-[#c9a961] active:text-black text-[#c9a961] font-mono font-bold text-[10px] rounded transition border border-[#c9a961]/30 cursor-pointer shrink-0"
                      >
                        🔎 Escanear Drive y Papelera
                      </button>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#c97a61]/15 max-w-md">
                    <span className="text-[10px] font-mono font-semibold uppercase text-[#c9a961] block mb-1">
                      🔗 ¿Tienes una planilla específica? Pega su enlace:
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Pega la URL de tu planilla aquí..."
                        className="flex-1 bg-black/40 text-white placeholder-neutral-600 border border-[#c97a61]/25 px-2 py-1.5 rounded font-mono text-[10px] focus:outline-none focus:border-[#c9a961]"
                        id="direct-error-connector-input"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            if (val) {
                              handleConnectCustomSheet(val);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const el = document.getElementById('direct-error-connector-input') as HTMLInputElement;
                          if (el && el.value) {
                            handleConnectCustomSheet(el.value);
                            el.value = '';
                          }
                        }}
                        className="px-3 py-1 bg-[#c9a961] hover:bg-[#b09252] text-black font-semibold rounded text-[10px] cursor-pointer"
                      >
                        Conectar
                      </button>
                    </div>
                  </div>

                  {searchLoading && (
                    <div className="flex items-center gap-2 text-[11px] text-[#c9a961] font-mono mt-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c9a961]" />
                      <span>Buscando planillas "Ferova_OS_Financiero" en tu unidad...</span>
                    </div>
                  )}

                  {searchError && (
                    <p className="text-[#c97a61] font-mono text-[10px] mt-2 bg-[#c97a61]/5 p-2 rounded border border-[#c97a61]/15">
                      ⚠️ {searchError}
                    </p>
                  )}

                  {relatedSheets.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="bg-[#11100e] border border-[#2a2620] rounded max-h-48 overflow-y-auto divide-y divide-[#2a2620]/45">
                        {relatedSheets.map((file) => (
                          <div key={file.id} className="p-2.5 flex items-center justify-between text-[11px] font-mono transition hover:bg-white/[0.02]">
                            <div className="space-y-1 pr-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-[#e8e3d8]" title={file.name}>
                                  {file.name}
                                </span>
                                {file.trashed ? (
                                  <span className="bg-[#c97a61]/15 text-[#c97a61] px-1.5 py-0.2 rounded text-[9px] font-semibold border border-[#c97a61]/25 uppercase">
                                    🗑️ En Papelera
                                  </span>
                                ) : (
                                  <span className="bg-[#a8c98a]/15 text-[#a8c98a] px-1.5 py-0.2 rounded text-[9px] font-semibold border border-[#a8c98a]/25 uppercase">
                                    📂 Activo
                                  </span>
                                )}
                              </div>
                              <p className="text-[#8a8377] text-[10px]">
                                ID: <span className="text-[#645e54]">{file.id.substring(0, 10)}...</span> • Modificado: {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : 'Desconocido'}
                              </p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 text-[#a39d8e] hover:text-white border border-[#2a2620] hover:bg-white/5 rounded text-[10px] flex items-center"
                                >
                                  Ver Hoja ↗
                                </a>
                              )}
                              <button
                                onClick={() => handleConnectSheet(file.id, file.name, file.trashed)}
                                className={`px-2.5 py-1 text-white font-bold rounded text-[10px] cursor-pointer transition ${
                                  file.trashed
                                    ? 'bg-[#c9a961] hover:bg-[#c9a961]/80 text-black border border-transparent font-sans'
                                    : 'bg-[#a8c98a]/20 border border-[#a8c98a]/45 text-[#a8c98a] hover:bg-[#a8c98a]/35'
                                }`}
                              >
                                {file.trashed ? '♻️ Restaurar y Conectar' : '🔌 Conectar'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => setRelatedSheets([])}
                          className="text-[10px] text-[#8a8377] hover:text-[#a39d8e] underline font-mono cursor-pointer"
                        >
                          Limpiar resultados del scanner
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Load databases spinner */}
          {!isReady && !errorMsg && (
            <div className="bg-[#161412] border border-[#2a2620] rounded-lg p-16 text-center text-xs space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-[#c9a961] mx-auto" />
              <p className="font-mono text-[#a39d8e] font-semibold tracking-wider">CONECTANDO A GOOGLE SHEETS...</p>
              <p className="text-[#8a8377] max-w-sm mx-auto leading-relaxed">
                Inicializando "Ferova_OS_Financiero" y emparejando tablas de control DIAN 2026 de forma segura.
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
                  respaldos={appData.respaldos} 
                  ventas={appData.ventas}
                  clientes={appData.clientes}
                  horas={appData.horas}
                  spreadsheetId={spreadsheetId}
                  spreadsheetLink={spreadsheetLink}
                  onSaveConfig={handleSaveConfig} 
                  onTriggerBackup={handleTriggerBackup} 
                  onWipeDatabase={handleWipeDatabase}
                  onRestoreBackup={handleRestoreBackup}
                  onConnectCustomSheet={handleConnectCustomSheet}
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

import React, { useRef, useState } from 'react';
import { Cliente, Venta, Hora, Config } from '../types';
import { Search, Download, Upload } from 'lucide-react';
import { useToast, errMsg } from './ui/toast';
import { InlineDeleteConfirm } from './ui/InlineDeleteConfirm';
import { downloadClientesTemplate, parseClientesCsv } from '../lib/csvImportExport';

interface ClientesAdminProps {
  clientes: Cliente[];
  ventas: Venta[];
  horas: Hora[];
  config: Config;
  onSaveClientes: (updated: Cliente[]) => Promise<void>;
  formatCop: (val: number) => string;
  formatUsd: (val: number) => string;
}

const COUNTRIES = [
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', currency: 'COP' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪', currency: 'USD' },
  { code: 'ES', name: 'España', flag: '🇪🇸', currency: 'USD' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', currency: 'USD' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', currency: 'USD' },
];

export default function ClientesAdmin({ 
  clientes, 
  ventas, 
  horas, 
  config, 
  onSaveClientes, 
  formatCop, 
  formatUsd 
}: ClientesAdminProps) {
  const { success: toastOk, error: toastErr } = useToast();
  // Form State
  const [nombre, setNombre] = useState('');
  const [id, setId] = useState('');
  const [pais, setPais] = useState('CO');
  const [declarante, setDeclarante] = useState(true);
  const [activo, setActivo] = useState(true);
  const [notas, setNotas] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteCliId, setConfirmDeleteCliId] = useState<string | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = async (file: File) => {
    setUploadingCsv(true);
    try {
      const text = await file.text();
      const merged = parseClientesCsv(text, clientes);
      await onSaveClientes(merged);
      toastOk(`Importados ${merged.length - clientes.length >= 0 ? merged.length - clientes.length : 0} clientes nuevos (${merged.length} en total).`);
    } catch (err: any) {
      toastErr(`Error importando el CSV: ${errMsg(err)}`);
    } finally {
      setUploadingCsv(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  // Handle country changes to set currency automatically
  const handleCountryChange = (pCode: string) => {
    setPais(pCode);
  };

  // Resolve derived currency and client type (CO -> Nacional, otherwise -> Internacional)
  const isNacional = pais === 'CO';
  const tipo = isNacional ? 'Nacional' : 'Internacional';

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    if (clientes.some(c => c.id.toLowerCase() === id.toLowerCase())) {
      toastErr('Ya existe un cliente con este ID único.');
      return;
    }

    const uniqueId = id.trim() || `cli_${Date.now().toString().slice(-4)}`;

    const newClient: Cliente = {
      id: uniqueId,
      nombre: nombre.trim(),
      tipo,
      declarante: isNacional ? declarante : false,
      activo,
      fecha_creacion: new Date().toISOString().split('T')[0],
      notas: notas.trim() || `${COUNTRIES.find(c => c.code === pais)?.flag} Ubicado en ${COUNTRIES.find(c => c.code === pais)?.name}`,
    };

    const updated = [...clientes, newClient];
    await onSaveClientes(updated);

    // Reset form
    setNombre('');
    setId('');
    setNotas('');
  };

  const handleDeleteClient = async (cliId: string) => {
    const updated = clientes.filter(c => c.id !== cliId);
    await onSaveClientes(updated);
    setConfirmDeleteCliId(null);
  };

  // Toggle active/inactive status quickly
  const toggleClientActiveStatus = async (cliId: string) => {
    const updated = clientes.map(c => {
      if (c.id === cliId) {
        return { ...c, activo: !c.activo };
      }
      return c;
    });
    await onSaveClientes(updated);
  };

  // Calculations for tables
  const getClientTotals = (cliId: string) => {
    // Total revenues
    const totalRevenuesOriginal = ventas
      .filter(v => v.cliente_id === cliId)
      .reduce((sum, v) => sum + (v.precio_venta_unitario * v.cantidad), 0);

    const clientVentas = ventas.filter(v => v.cliente_id === cliId);
    const usesUsd = clientVentas.some(v => v.moneda === 'USD') || clientes.find(c => c.id === cliId)?.tipo === 'Internacional';

    // Total hours logged
    const totalHrs = horas
      .filter(h => h.cliente_id === cliId)
      .reduce((sum, h) => sum + h.horas, 0);

    return {
      revenueStr: usesUsd ? formatUsd(totalRevenuesOriginal) : formatCop(totalRevenuesOriginal),
      hours: totalHrs
    };
  };

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in text-slate-900">

      {/* Title block */}
      <div className="border-b border-slate-200 pb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-medium text-blue-600">Maestro de Clientes</h2>
          <p className="text-xs text-slate-500 font-mono mt-1">Configuración fiscal y de localización por cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={downloadClientesTemplate} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" /> Plantilla CSV
          </button>
          <button type="button" onClick={() => csvInputRef.current?.click()} disabled={uploadingCsv} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" /> {uploadingCsv ? 'Subiendo...' : 'Subir CSV'}
          </button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleCsvUpload(f); }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Form panel */}
        <form onSubmit={handleCreateClient} className="lg:col-span-4 bg-white border border-slate-200 pb-6 rounded-lg overflow-hidden space-y-4">
          <div className="bg-white/[0.02] border-b border-slate-200 px-5 py-4">
            <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
              Nuevo Perfil de Cliente
            </h3>
          </div>

          <div className="px-5 space-y-4 text-xs font-sans">
            
            {/* ID */}
            <div>
              <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">ID Único / RUT NIT</label>
              <input 
                type="text"
                placeholder="Ej: 901234567-8 o RUTA_N"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
                className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded font-mono focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Nombre Comercial</label>
              <input 
                type="text"
                placeholder="Ej: Ruta N S.A.S"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            {/* País */}
            <div>
              <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Ubicación y Jurisdicción</label>
              <select 
                value={pais}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              >
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code} className="bg-[#0f0e0c]">
                    {c.flag} {c.name} ({c.currency})
                  </option>
                ))}
              </select>
            </div>

            {/* If CO, declare Renta filter */}
            {isNacional && (
              <div className="bg-slate-100 border border-slate-200 p-3 rounded flex items-center justify-between">
                <div>
                  <span className="block font-semibold">Declarante de Renta</span>
                  <span className="text-[10px] text-slate-400 block">Aplica tarifa 4% (SI) o 6% (NO)</span>
                </div>
                <input 
                  type="checkbox"
                  checked={declarante}
                  onChange={(e) => setDeclarante(e.target.checked)}
                  className="w-4.5 h-4.5 accent-blue-600 cursor-pointer"
                />
              </div>
            )}

            {/* Activo / Inactivo */}
            <div className="bg-slate-100 border border-slate-200 p-3 rounded flex items-center justify-between">
              <div>
                <span className="block font-semibold">Cliente Activo</span>
                <span className="text-[10px] text-slate-400 block">Aparece en listas de facturación</span>
              </div>
              <input 
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="w-4.5 h-4.5 accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Notas */}
            <div>
              <label className="block text-slate-500 text-[10px] uppercase font-mono mb-1">Notas Internas</label>
              <textarea 
                rows={2}
                placeholder="Persona de contacto, observaciones clave..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full bg-slate-50 text-slate-900 border border-slate-200 p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-[#b09252] text-black font-semibold font-display py-3 rounded transition cursor-pointer"
            >
              Registrar Perfil
            </button>

          </div>
        </form>

        {/* List ledger */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-white/[0.02] border-b border-slate-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase font-semibold">
                Directorio Corporativo de Clientes
              </h3>

              <div className="relative text-xs">
                <input 
                  type="text"
                  placeholder="Buscar por nombre o ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 text-slate-900 border border-slate-200 max-w-sm pl-8 pr-4 py-1.5 rounded focus:outline-none focus:border-[#c9a961] font-sans"
                />
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-100 text-slate-500 uppercase tracking-wider font-semibold font-mono border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3.5">ID / RUT</th>
                    <th className="px-5 py-3.5">Nombre Razon</th>
                    <th className="px-5 py-3.5">Localidad</th>
                    <th className="px-5 py-3.5">Fórmula Fiscal (Rete)</th>
                    <th className="px-5 py-3.5">Pactado Tot. Periodo</th>
                    <th className="px-5 py-3.5">Dedicación Horas</th>
                    <th className="px-5 py-3.5 text-right">Estado</th>
                    <th className="px-5 py-3.5 text-right">Borrar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2620]/40">
                  {filteredClientes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-slate-400 font-mono">
                        Aún no se han configurado perfiles de clientes.
                      </td>
                    </tr>
                  ) : (
                    filteredClientes.map(c => {
                      const computedStats = getClientTotals(c.id);
                      
                      // Resolve country flag representation
                      // Try to deduce country from notas or use simple defaults
                      // We can search COUNTRIES table or look for flag
                      let cFlag = '🇨🇴';
                      if (c.tipo === 'Internacional') {
                        if (c.notas?.includes('🇺🇸') || c.notas?.includes('US')) cFlag = '🇺🇸';
                        else if (c.notas?.includes('🇵🇪') || c.notas?.includes('PE')) cFlag = '🇵🇪';
                        else if (c.notas?.includes('🇪🇸') || c.notas?.includes('ES')) cFlag = '🇪🇸';
                        else if (c.notas?.includes('🇧🇷') || c.notas?.includes('BR')) cFlag = '🇧🇷';
                        else cFlag = '🌎';
                      }

                      return (
                        <tr key={c.id} className="hover:bg-white/[0.01]/70 transition">
                          <td className="px-5 py-4 font-mono text-slate-500">{c.id}</td>
                          <td className="px-5 py-4 font-semibold text-slate-900">{c.nombre}</td>
                          <td className="px-5 py-4">
                            <span className="font-mono flex items-center gap-1.5">
                              <span>{cFlag}</span>
                              <span className="text-[10px] text-slate-500 font-semibold">{c.tipo}</span>
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {c.tipo === 'Internacional' ? (
                              <span className="text-slate-400 italic">Exportado / Rete 0%</span>
                            ) : c.declarante ? (
                              <span className="text-[#a8c98a] bg-[#a8c98a]/10 border border-[#a8c98a]/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                                CO Declarante (4%)
                              </span>
                            ) : (
                              <span className="text-[#c99a61] bg-[#c99a61]/10 border border-[#c99a61]/25 px-2 py-0.5 rounded text-[10px] font-semibold">
                                CO No Declarante (6%)
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 font-mono font-bold text-slate-900">
                            {computedStats.revenueStr}
                          </td>
                          <td className="px-5 py-4 font-mono text-slate-500">
                            {computedStats.hours > 0 ? (
                              <span className="font-semibold text-blue-600">{computedStats.hours.toFixed(1)} hs</span>
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button 
                              onClick={() => toggleClientActiveStatus(c.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider font-semibold cursor-pointer ${
                                c.activo 
                                  ? 'text-[#a8c98a] bg-[#a8c98a]/10 hover:bg-[#a8c98a]/20 border border-[#a8c98a]/30' 
                                  : 'text-slate-400 bg-white/[0.02] hover:bg-white/[0.04] border border-slate-200'
                              }`}
                            >
                              {c.activo ? 'ACTIVO' : 'BAJA'}
                            </button>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <InlineDeleteConfirm
                              confirming={confirmDeleteCliId === c.id}
                              onRequestConfirm={() => setConfirmDeleteCliId(c.id)}
                              onConfirm={() => handleDeleteClient(c.id)}
                              onCancel={() => setConfirmDeleteCliId(null)}
                              className="justify-end max-w-[70px] ml-auto"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

import React, { useState } from 'react';
import { Cliente, Venta, Hora, Config } from '../types';
import { convertToCop } from '../lib/calculations';
import { Plus, Trash2, CheckCircle2, XCircle, Globe, Search, Check, X } from 'lucide-react';

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
  // Form State
  const [nombre, setNombre] = useState('');
  const [id, setId] = useState('');
  const [pais, setPais] = useState('CO');
  const [declarante, setDeclarante] = useState(true);
  const [activo, setActivo] = useState(true);
  const [notas, setNotas] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteCliId, setConfirmDeleteCliId] = useState<string | null>(null);

  // Handle country changes to set currency automatically
  const handleCountryChange = (pCode: string) => {
    setPais(pCode);
  };

  // Resolve derived currency and client type (CO -> Nacional, otherwise -> Internacional)
  const isNacional = pais === 'CO';
  const currency = isNacional ? 'COP' : 'USD';
  const tipo = isNacional ? 'Nacional' : 'Internacional';

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;

    if (clientes.some(c => c.id.toLowerCase() === id.toLowerCase())) {
      alert('Ya existe un cliente con este ID único.');
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
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">

      {/* Title block */}
      <div className="border-b border-[#2a2620] pb-5">
        <h2 className="text-xl font-display font-medium text-[#c9a961]">Maestro de Clientes</h2>
        <p className="text-xs text-[#a39d8e] font-mono mt-1">Configuración fiscal y de localización por cliente</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Form panel */}
        <form onSubmit={handleCreateClient} className="lg:col-span-4 bg-[#161412] border border-[#2a2620] pb-6 rounded-lg overflow-hidden space-y-4">
          <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-4">
            <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
              Nuevo Perfil de Cliente
            </h3>
          </div>

          <div className="px-5 space-y-4 text-xs font-sans">
            
            {/* ID */}
            <div>
              <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">ID Único / RUT NIT</label>
              <input 
                type="text"
                placeholder="Ej: 901234567-8 o RUTA_N"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
                className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded font-mono focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Nombre Comercial</label>
              <input 
                type="text"
                placeholder="Ej: Ruta N S.A.S"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            {/* País */}
            <div>
              <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Ubicación y Jurisdicción</label>
              <select 
                value={pais}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
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
              <div className="bg-[#1c1916] border border-[#2a2620] p-3 rounded flex items-center justify-between">
                <div>
                  <span className="block font-semibold">Declarante de Renta</span>
                  <span className="text-[10px] text-[#8a8377] block">Aplica tarifa 4% (SI) o 6% (NO)</span>
                </div>
                <input 
                  type="checkbox"
                  checked={declarante}
                  onChange={(e) => setDeclarante(e.target.checked)}
                  className="w-4.5 h-4.5 accent-[#c9a961] cursor-pointer"
                />
              </div>
            )}

            {/* Activo / Inactivo */}
            <div className="bg-[#1c1916] border border-[#2a2620] p-3 rounded flex items-center justify-between">
              <div>
                <span className="block font-semibold">Cliente Activo</span>
                <span className="text-[10px] text-[#8a8377] block">Aparece en listas de facturación</span>
              </div>
              <input 
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="w-4.5 h-4.5 accent-[#c9a961] cursor-pointer"
              />
            </div>

            {/* Notas */}
            <div>
              <label className="block text-[#a39d8e] text-[10px] uppercase font-mono mb-1">Notas Internas</label>
              <textarea 
                rows={2}
                placeholder="Persona de contacto, observaciones clave..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-[#c9a961] hover:bg-[#b09252] text-black font-semibold font-display py-3 rounded transition cursor-pointer"
            >
              Registrar Perfil
            </button>

          </div>
        </form>

        {/* List ledger */}
        <div className="lg:col-span-8 bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-white/[0.02] border-b border-[#2a2620] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-xs font-mono tracking-widest text-[#a39d8e] uppercase font-semibold">
                Directorio Corporativo de Clientes
              </h3>

              <div className="relative text-xs">
                <input 
                  type="text"
                  placeholder="Buscar por nombre o ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] max-w-sm pl-8 pr-4 py-1.5 rounded focus:outline-none focus:border-[#c9a961] font-sans"
                />
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#8a8377]" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#1c1916] text-[#a39d8e] uppercase tracking-wider font-semibold font-mono border-b border-[#2a2620]">
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
                      <td colSpan={8} className="px-5 py-10 text-center text-[#8a8377] font-mono">
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
                          <td className="px-5 py-4 font-mono text-[#a39d8e]">{c.id}</td>
                          <td className="px-5 py-4 font-semibold text-[#e8e3d8]">{c.nombre}</td>
                          <td className="px-5 py-4">
                            <span className="font-mono flex items-center gap-1.5">
                              <span>{cFlag}</span>
                              <span className="text-[10px] text-[#a39d8e] font-semibold">{c.tipo}</span>
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {c.tipo === 'Internacional' ? (
                              <span className="text-[#8a8377] italic">Exportado / Rete 0%</span>
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
                          <td className="px-5 py-4 font-mono font-bold text-[#e8e3d8]">
                            {computedStats.revenueStr}
                          </td>
                          <td className="px-5 py-4 font-mono text-[#a39d8e]">
                            {computedStats.hours > 0 ? (
                              <span className="font-semibold text-[#c9a961]">{computedStats.hours.toFixed(1)} hs</span>
                            ) : (
                              <span className="text-[#8a8377] italic">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button 
                              onClick={() => toggleClientActiveStatus(c.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-wider font-semibold cursor-pointer ${
                                c.activo 
                                  ? 'text-[#a8c98a] bg-[#a8c98a]/10 hover:bg-[#a8c98a]/20 border border-[#a8c98a]/30' 
                                  : 'text-[#8a8377] bg-white/[0.02] hover:bg-white/[0.04] border border-[#2a2620]'
                              }`}
                            >
                              {c.activo ? 'ACTIVO' : 'BAJA'}
                            </button>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {confirmDeleteCliId === c.id ? (
                              <div className="flex items-center justify-end gap-1 bg-[#1a1110] border border-[#c97a61]/30 p-1 rounded max-w-[70px] ml-auto">
                                <button 
                                  onClick={() => handleDeleteClient(c.id)}
                                  title="Confirmar eliminación"
                                  className="text-[#a8c98a] hover:text-[#bde89b] font-bold text-xs px-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setConfirmDeleteCliId(null)}
                                  title="Cancelar"
                                  className="text-[#c97a61] hover:text-[#e08970] font-bold text-xs px-1 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setConfirmDeleteCliId(c.id)}
                                className="text-[#c97a61] hover:text-[#e08970] p-1.5 transition rounded-lg hover:bg-[#c97a61]/10 bg-[#0f0e0c]/40 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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

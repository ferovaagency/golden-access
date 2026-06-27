import React, { useState } from 'react';
import { PagoEgreso, Config } from '../types';
import { 
  Coins, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  Calendar, 
  FileText, 
  DollarSign, 
  Wallet, 
  Save, 
  Check, 
  Layers,
  ArrowDownCircle,
  TrendingDown
} from 'lucide-react';

interface PagosEgresosAdminProps {
  pagosEgresos: PagoEgreso[];
  config: Config;
  onSavePagosEgresos: (updated: PagoEgreso[]) => Promise<void>;
}

export default function PagosEgresosAdmin({ pagosEgresos = [], config, onSavePagosEgresos }: PagosEgresosAdminProps) {
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Form state
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [concepto, setConcepto] = useState('');
  const [categoria, setCategoria] = useState<'Herramientas' | 'Salarios' | 'Contratistas' | 'Administrativo' | 'Otros'>('Salarios');
  const [monto, setMonto] = useState<number | ''>('');
  const [moneda, setMoneda] = useState<'COP' | 'USD'>('COP');
  const [metodoPago, setMetodoPago] = useState('Bancolombia');
  const [notas, setNotas] = useState('');

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');

  // Format helper functions
  const formatCop = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatUsd = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleAddPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concepto.trim() || !monto || Number(monto) <= 0) {
      alert('Por favor, indica un concepto de pago y un monto mayor que cero.');
      return;
    }

    setSaving(true);
    setSuccessMsg('');

    const newPago: PagoEgreso = {
      id: `p_${Date.now().toString().slice(-6)}`,
      fecha,
      concepto: concepto.trim(),
      categoria,
      monto: Number(monto),
      moneda,
      metodo_pago: metodoPago,
      notas: notas.trim() || undefined
    };

    const updated = [newPago, ...pagosEgresos];

    try {
      await onSavePagosEgresos(updated);
      setSuccessMsg('¡Pago registrado con éxito y sincronizado con Sheets!');
      
      // Reset form fields
      setConcepto('');
      setMonto('');
      setNotas('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`Error al registrar pago: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePago = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este registro de pago?')) return;
    setSaving(true);
    setSuccessMsg('');
    const updated = pagosEgresos.filter(p => p.id !== id);
    try {
      await onSavePagosEgresos(updated);
      setSuccessMsg('Registro de pago eliminado con éxito.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  // Filter payments
  const filteredPagos = pagosEgresos.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      p.concepto.toLowerCase().includes(term) || 
      (p.notas && p.notas.toLowerCase().includes(term)) ||
      p.metodo_pago.toLowerCase().includes(term);
    
    const matchesCategory = categoryFilter === 'all' || p.categoria === categoryFilter;
    const matchesCurrency = currencyFilter === 'all' || p.moneda === currencyFilter;

    return matchesSearch && matchesCategory && matchesCurrency;
  });

  // Calculate totals
  const totalPagadoCop = filteredPagos
    .filter(p => p.moneda === 'COP')
    .reduce((r, p) => r + p.monto, 0);

  const totalPagadoUsd = filteredPagos
    .filter(p => p.moneda === 'USD')
    .reduce((r, p) => r + p.monto, 0);

  // Convert USD to COP using TRM for cumulative total
  const trmValue = config.trm || 4000;
  const totalEgresoConsolidadoCop = totalPagadoCop + (totalPagadoUsd * trmValue);

  return (
    <div className="space-y-8 animate-fade-in text-[#e8e3d8]">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2a2620] pb-5">
        <div>
          <h2 className="text-xl font-display font-medium text-[#c9a961] flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-[#c9a961]" /> Registro de Prácticas de Egreso (Pagos Efectuados)
          </h2>
          <p className="text-xs text-[#a39d8e] font-mono mt-1">
            Lleva el control cronológico de los desembolsos reales de heramientas (SaaS), nómina/salarios de socios, pagos a contratistas externos y costos administrativos.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 p-4 rounded-lg flex items-center gap-2 font-mono">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Aggregate metrics bento widget cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-[#161412] border border-[#2a2620] p-4 rounded-lg">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#a39d8e]">Egresos en Pesos (COP)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-mono text-[#c9a961] font-bold">
              {formatCop(totalPagadoCop)}
            </span>
            <span className="text-[10px] font-mono text-[#8a8377]">reales</span>
          </div>
          <span className="text-[10px] text-[#8a8377] font-mono mt-2 block">Suma de pagos efectuados en COP.</span>
        </div>

        <div className="bg-[#161412] border border-[#2a2620] p-4 rounded-lg">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#a39d8e]">Egresos en Dólares (USD)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-mono text-[#c9a961] font-bold">
              {formatUsd(totalPagadoUsd)}
            </span>
            <span className="text-[10px] font-mono text-[#8a8377]">moneda extranjera</span>
          </div>
          <span className="text-[10px] text-[#8a8377] font-mono mt-2 block">Suma de pagos de herramientas (SaaS) y proveedores.</span>
        </div>

        <div className="bg-[#161412] border border-[#2a2620] p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#a39d8e]">Egreso Consolidado (COP)</span>
            <span className="text-[9px] font-mono text-[#c9a961] bg-[#c9a961]/10 px-1.5 py-0.2 rounded">TRM: {formatCop(trmValue)}</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-mono text-[#c97a61] font-bold">
              {formatCop(totalEgresoConsolidadoCop)}
            </span>
            <span className="text-[10px] font-mono text-[#8a8377]">total</span>
          </div>
          <span className="text-[10px] text-[#8a8377] font-mono mt-2 block">Egreso global unificado a tasa TRM del mes.</span>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form to Log payment */}
        <div className="lg:col-span-4 bg-[#161412] border border-[#2a2620] p-5 rounded-lg space-y-4">
          <div className="flex items-center gap-2 border-b border-[#2a2620] pb-3">
            <ArrowDownCircle className="w-4h-4 text-[#c9a961]" />
            <span className="text-xs font-mono uppercase tracking-widest text-[#a39d8e] font-bold">Registrar Desembolso</span>
          </div>

          <form onSubmit={handleAddPago} className="space-y-4 text-xs">
            
            {/* Concepto */}
            <div>
              <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[9px]">Concepto / Detalle del Pago</label>
              <input 
                type="text"
                required
                placeholder="Ej. Liquidación Juan C. (SEO Copywriter)"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Fecha */}
              <div>
                <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[9px]">Fecha de Pago</label>
                <input 
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full bg-[#0f0e0c]/50 text-[#e8e3d8] border border-[#2a2620] p-2 rounded focus:outline-none"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[9px]">Tipo / Categoría</label>
                <select 
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as any)}
                  className="w-full bg-[#0f0e0c] text-white border border-[#2a2620] p-2 rounded focus:outline-none font-medium"
                >
                  <option value="Herramientas">SaaS / Herramientas</option>
                  <option value="Salarios">Salarios / Socios</option>
                  <option value="Contratistas">Contratistas Externos</option>
                  <option value="Administrativo">Costos Oficina</option>
                  <option value="Otros">Gastos Varios / Otros</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Monto */}
              <div>
                <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[9px]">Monto Pagado</label>
                <input 
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#0f0e0c]/50 text-[#a8c98a] border border-[#2a2620] p-2 rounded font-mono focus:outline-none font-semibold text-xs"
                />
              </div>

              {/* Moneda */}
              <div>
                <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[9px]">Divisa</label>
                <div className="grid grid-cols-2 gap-1 bg-[#0f0e0c]/40 p-1 rounded border border-[#2a2620]">
                  <button 
                    type="button" 
                    onClick={() => setMoneda('COP')}
                    className={`p-1 text-[10px] font-mono rounded font-bold transition cursor-pointer ${moneda === 'COP' ? 'bg-[#c9a961] text-black' : 'text-[#a39d8e] hover:text-white'}`}
                  >
                    COP
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setMoneda('USD')}
                    className={`p-1 text-[10px] font-mono rounded font-bold transition cursor-pointer ${moneda === 'USD' ? 'bg-[#c9a961] text-black' : 'text-[#a39d8e] hover:text-white'}`}
                  >
                    USD
                  </button>
                </div>
              </div>
            </div>

            {/* Metodo de Pago */}
            <div>
              <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[9px]">Método de Pago / Origen</label>
              <input 
                type="text"
                placeholder="Ej. Transferencia Bancolombia, Tarjeta de Crédito, Efectivo, Pyg"
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2.5 rounded focus:outline-none focus:border-[#c9a961]"
              />
            </div>

            {/* Notas opcionales */}
            <div>
              <label className="block text-[#a39d8e] font-semibold mb-1 uppercase tracking-wider font-mono text-[9px]">Notas / Comprobante (Opcional)</label>
              <textarea 
                rows={2}
                placeholder="Nro. Factura, cuenta de cobro, link a comprobante drive..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full bg-[#0f0e0c]/50 text-white border border-[#2a2620] p-2 rounded focus:outline-none placeholder-[#c9a961]/20 font-sans text-xs"
              />
            </div>

            <button 
              type="submit"
              disabled={saving}
              className="w-full bg-[#c9a961] hover:bg-[#b09252] disabled:bg-[#2a2620] text-black font-semibold font-mono tracking-wide py-2.5 rounded transition font-bold cursor-pointer"
            >
              {saving ? 'Registrando...' : 'Registrar Pago de Egreso'}
            </button>

          </form>
        </div>

        {/* Right Column: Payments Log */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-[#161412] border border-[#2a2620] p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            
            {/* Search input */}
            <div className="relative w-full md:w-60">
              <input 
                type="text"
                placeholder="Buscar pagos por concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0f0e0c]/65 text-[#e8e3d8] border border-[#2a2620] pl-8.5 pr-3 py-1.5 rounded focus:outline-none focus:border-[#c9a961] text-xs"
              />
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#8a8377]" />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
              
              {/* Category Filter */}
              <div className="flex items-center gap-1.5 bg-[#0f0e0c]/50 px-2 py-1 rounded border border-[#2a2620]">
                <Filter className="w-3 h-3 text-[#c9a961]" />
                <select 
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-transparent text-white focus:outline-none text-[11px] font-mono cursor-pointer"
                >
                  <option value="all">Categoría (Todas)</option>
                  <option value="Herramientas">SaaS / Herramientas</option>
                  <option value="Salarios">Salarios / Socios</option>
                  <option value="Contratistas">Contratistas Externos</option>
                  <option value="Administrativo">Costos Oficina</option>
                  <option value="Otros">Gastos Varios / Otros</option>
                </select>
              </div>

              {/* Currency Filter */}
              <div className="flex items-center gap-1.5 bg-[#0f0e0c]/50 px-2 py-1 rounded border border-[#2a2620]">
                <Coins className="w-3 h-3 text-[#c9a961]" />
                <select 
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value)}
                  className="bg-transparent text-white focus:outline-none text-[11px] font-mono cursor-pointer"
                >
                  <option value="all">Divisa (Todas)</option>
                  <option value="COP">COP ($)</option>
                  <option value="USD">USD (US$)</option>
                </select>
              </div>

            </div>

          </div>

          {/* Table list */}
          <div className="bg-[#161412] border border-[#2a2620] rounded-lg overflow-hidden">
            <div className="bg-white/[0.02] border-b border-[#2a2620] px-4 py-3 text-xs font-mono font-bold tracking-wider text-[#a39d8e] flex justify-between items-center">
              <span>Registro Cronológico de Salidas</span>
              <span className="text-[10px] text-[#8a8377] font-semibold">{filteredPagos.length} registros</span>
            </div>

            <div className="overflow-x-auto">
              {filteredPagos.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8a8377] font-mono italic">
                  No se encontraron registros de egresos con los parámetros de búsqueda indicados.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/[0.01] border-b border-[#2a2620] text-[#8a8377] font-mono text-[10px]">
                      <th className="p-3 pl-4">Fecha</th>
                      <th className="p-3">Detalle & Concepto</th>
                      <th className="p-3">Categoría</th>
                      <th className="p-3">Monto de Salida</th>
                      <th className="p-3">Medio Pago</th>
                      <th className="p-3 text-right pr-4">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2620]/45">
                    {filteredPagos.map((p) => {
                      const isHighGasto = p.moneda === 'COP' ? p.monto >= 2000000 : p.monto >= 500;
                      return (
                        <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-3 pl-4 font-mono select-all text-[#a39d8e]">
                            {p.fecha}
                          </td>
                          <td className="p-3 max-w-[200px]">
                            <span className="font-semibold text-[#e8e3d8] block leading-snug">{p.concepto}</span>
                            {p.notas && (
                              <span className="block text-[10px] text-[#8a8377] leading-tight pt-0.5">{p.notas}</span>
                            )}
                          </td>
                          <td className="p-3 font-mono">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              p.categoria === 'Salarios'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : p.categoria === 'Herramientas'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : p.categoria === 'Contratistas'
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : p.categoria === 'Administrativo'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'
                            }`}>
                              {p.categoria === 'Salarios' ? 'Salarios / Socios' : p.categoria}
                            </span>
                          </td>
                          <td className="p-3 font-semibold font-mono">
                            <span className={isHighGasto ? 'text-[#c97a61]' : 'text-[#a8c98a]'}>
                              {p.moneda === 'USD' ? formatUsd(p.monto) : formatCop(p.monto)}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-[#a39d8e]">
                            {p.metodo_pago}
                          </td>
                          <td className="p-3 text-right pr-4">
                            <button 
                              type="button"
                              onClick={() => handleDeletePago(p.id)}
                              className="text-[#8a8377] hover:text-[#c97a61] p-1.5 transition rounded hover:bg-[#c97a61]/5 inline-flex cursor-pointer"
                              title="Eliminar este pago de egreso"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

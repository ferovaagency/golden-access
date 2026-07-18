import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import type { AppData } from '../types';
import { buildFinancialStatement, financialStatementCsv } from '../lib/financialStatement';
import { getAccessToken } from '../lib/supabase';
import { syncFinancialStatementToSheets } from '../lib/sheetsService';
import { useFiscalProfile } from '../hooks/useFiscalProfile';

interface Props {
  userId: string;
  appData: AppData;
  period: string;
  formatCop: (value: number) => string;
}

const buttonClass = 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

export default function FinancialStatement({ userId, appData, period, formatCop }: Props) {
  const { profile } = useFiscalProfile(userId);
  const [syncing, setSyncing] = useState(false);
  const statement = useMemo(() => buildFinancialStatement(appData, period, profile), [appData, period, profile]);

  const downloadCsv = () => {
    const blob = new Blob(['\uFEFF', financialStatementCsv(statement)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `estado-financiero-${period}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printStatement = () => {
    const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character));
    const rows = statement.rows.map((row) => `<tr class="${row.total ? 'total' : ''}"><td>${safe(row.section)}</td><td>${safe(row.concept)}</td><td>${safe(formatCop(row.amount))}</td></tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Estado financiero ${safe(period)}</title><style>body{font-family:Arial,sans-serif;color:#0f172a;padding:40px}h1{margin:0}p{color:#64748b}table{border-collapse:collapse;width:100%;margin-top:24px}td,th{border-bottom:1px solid #e2e8f0;padding:10px;text-align:left}td:last-child,th:last-child{text-align:right}.total{font-weight:700;background:#f8fafc}.note{font-size:12px;margin-top:20px}@media print{button{display:none}}</style></head><body><h1>Ferova One · Estado financiero básico</h1><p>Periodo: ${safe(period)} · Generado: ${safe(new Date(statement.generatedAt).toLocaleString('es-CO'))}</p><table><thead><tr><th>Sección</th><th>Concepto</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>${statement.fiscalNotice ? `<p class="note">${safe(statement.fiscalNotice)}</p>` : ''}<p class="note">Documento gerencial informativo. No reemplaza estados financieros certificados por un contador.</p><button onclick="window.print()">Guardar como PDF / imprimir</button></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const syncToSheets = async () => {
    const token = getAccessToken();
    if (!token) {
      alert('Conecta nuevamente Google desde Ajustes para guardar este estado en Sheets. El acceso no se conserva en el navegador por seguridad.');
      return;
    }
    setSyncing(true);
    try {
      await syncFinancialStatementToSheets(token, statement);
      alert('Estado financiero guardado en la pestaña EstadoFinanciero de tu Google Sheet.');
    } catch (error: any) {
      alert(`No se pudo guardar en Sheets: ${error?.message || error}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Estado financiero básico</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Vista gerencial de resultados y pagos reales. Puedes llevarla a Sheets, Excel o PDF.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={syncToSheets} disabled={syncing}><FileSpreadsheet className="h-4 w-4" />{syncing ? 'Guardando…' : 'Guardar en Sheets'}</button>
            <button type="button" className={buttonClass} onClick={downloadCsv}><Download className="h-4 w-4" />Descargar para Excel</button>
            <button type="button" className={buttonClass} onClick={printStatement}><Printer className="h-4 w-4" />PDF / imprimir</button>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-2">Sección</th><th>Concepto</th><th className="text-right">Valor</th></tr></thead>
            <tbody>{statement.rows.map((row) => <tr key={`${row.section}-${row.concept}`} className={`border-b border-slate-100 ${row.total ? 'bg-slate-50 font-bold text-slate-950' : 'text-slate-700'}`}><td className="py-2 text-xs text-slate-500">{row.section}</td><td>{row.concept}</td><td className={`text-right ${row.amount < 0 ? 'text-red-600' : ''}`}>{formatCop(row.amount)}</td></tr>)}</tbody>
          </table>
        </div>
        {statement.fiscalNotice && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{statement.fiscalNotice}</p>}
        <p className="mt-4 text-[11px] text-slate-400">Documento gerencial informativo; no reemplaza estados financieros certificados.</p>
      </section>
    </div>
  );
}

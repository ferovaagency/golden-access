/**
 * Domain-specific sync of finance data (statement, receivables, payables,
 * expense documents) into the "Ferova_OS_Financiero" spreadsheet. Split out
 * of sheetsService.ts (Fase 3 del roadmap).
 */
import type { OtroGasto, PagoEgreso } from '../../types';
import type { Receivable } from '../receivablesService';
import type { Payable } from '../payablesService';
import type { FinancialStatement } from '../financialStatement';
import { activeFinancialSpreadsheet, saveSheetTable } from './spreadsheetWrite';

export async function syncFinancialStatementToSheets(accessToken: string, statement: FinancialStatement): Promise<void> {
  const spreadsheetId = await activeFinancialSpreadsheet(accessToken);
  await saveSheetTable(
    spreadsheetId,
    accessToken,
    'EstadoFinanciero',
    ['Periodo', 'Sección', 'Concepto', 'Valor COP', 'Es total', 'Generado'],
    statement.rows.map((row) => [statement.period, row.section, row.concept, row.amount, row.total ? 'Sí' : 'No', statement.generatedAt]),
  );
}

/**
 * Keeps operational invoices in Sheets using only their Google Drive links.
 * Drive stores the binary file; Supabase and Sheets store the same webViewLink.
 */
export async function syncReceivablesToSheets(accessToken: string, rows: Receivable[]): Promise<void> {
  const spreadsheetId = await activeFinancialSpreadsheet(accessToken);
  await saveSheetTable(spreadsheetId, accessToken, 'PorCobrar',
    ['id', 'cliente_id', 'factura', 'concepto', 'valor', 'moneda', 'vencimiento', 'estado', 'notas', 'documento_drive_url', 'documento_nombre'],
    rows.map((row) => [row.id, row.cliente_id || '', row.factura || '', row.concepto, row.valor, row.moneda, row.vencimiento || '', row.estado, row.notas || '', row.documento_url || '', row.documento_nombre || ''])
  );
}

export async function syncPayablesToSheets(accessToken: string, rows: Payable[]): Promise<void> {
  const spreadsheetId = await activeFinancialSpreadsheet(accessToken);
  await saveSheetTable(spreadsheetId, accessToken, 'PorPagar',
    ['id', 'proveedor', 'factura', 'concepto', 'valor', 'moneda', 'vencimiento', 'fecha_pago_real', 'monto_pagado', 'estado', 'notas', 'documento_drive_url', 'documento_nombre'],
    rows.map((row) => [row.id, row.proveedor, row.factura || '', row.concepto || '', row.valor, row.moneda, row.vencimiento || '', row.fecha_pago_real || '', row.monto_pagado ?? '', row.estado, row.notas || '', row.documento_url || '', row.documento_nombre || ''])
  );
}

export async function syncExpenseDocumentsToSheets(
  accessToken: string,
  otrosGastos: OtroGasto[],
  pagosEgresos: PagoEgreso[],
): Promise<void> {
  const spreadsheetId = await activeFinancialSpreadsheet(accessToken);
  await Promise.all([
    saveSheetTable(spreadsheetId, accessToken, 'OtrosGastos',
      ['id', 'nombre', 'monto', 'moneda', 'categoria', 'comprobante_drive_url', 'comprobante_nombre'],
      otrosGastos.map((row) => [row.id, row.nombre, row.monto, row.moneda, row.categoria, row.comprobante_url || '', row.comprobante_nombre || ''])
    ),
    saveSheetTable(spreadsheetId, accessToken, 'PagosEgresos',
      ['id', 'fecha', 'concepto', 'categoria', 'monto', 'moneda', 'metodo_pago', 'notas', 'comprobante_drive_url', 'comprobante_nombre'],
      pagosEgresos.map((row) => [row.id, row.fecha, row.concepto, row.categoria, row.monto, row.moneda, row.metodo_pago, row.notas || '', row.comprobante_url || '', row.comprobante_nombre || ''])
    ),
  ]);
}

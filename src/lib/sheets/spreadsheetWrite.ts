/**
 * Generic table-range writes against the "Ferova_OS_Financiero" spreadsheet,
 * plus the find-or-create helper that finance/backup sync depends on. Split
 * out of sheetsService.ts (Fase 3 del roadmap).
 */
import type { Config } from '../../types';
import { findSpreadsheet } from './driveFiles';
import { createSpreadsheet } from './spreadsheetSchema';

/**
 * Overwrites a sheet range with given headers and rows
 */
export async function saveSheetTable(
  spreadsheetId: string,
  accessToken: string,
  sheetName: string,
  headers: string[],
  rows: any[][]
): Promise<void> {
  const cellData = [headers, ...rows];

  // Verify sheet existence on-the-fly and create it if missing
  try {
    const listUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title))`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (listRes.ok) {
      const info = await listRes.json();
      const existing: string[] = (info.sheets || []).map((s: any) => s.properties?.title || '');
      if (!existing.includes(sheetName)) {
        const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
        await fetch(updateUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: { title: sheetName }
              }
            }]
          })
        });
      }
    }
  } catch (err) {
    console.error(`Error ensuring worksheet '${sheetName}' exists prior to saving:`, err);
  }

  // We clear or put values starting from cell A1.
  // First clear the existing data to make sure no trailing lines are left.
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:Z5000:clear`;
  await fetch(clearUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1?valueInputOption=USER_ENTERED`;
  const response = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: cellData,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error guardando tabla ${sheetName}: ${response.statusText}`);
  }
}

/**
 * Specifically updates the Config row in the spreadsheet
 */
export async function updateConfigInSheet(
  spreadsheetId: string,
  accessToken: string,
  config: Config
): Promise<void> {
  const headers = [
    'trm', 'uvt', 'smmlv', 'tope_no_declarante_uvt', 'tope_no_paga_renta_uvt', 'tope_responsable_iva_uvt',
    'retencion_servicio_min_uvt', 'tarifa_ret_declarante', 'tarifa_ret_no_declarante', 'tarifa_salud',
    'tarifa_pension', 'ibc_porcentaje', 'tarifa_iva', 'salario_propuesto', 'horas_objetivo_mes', 'meta_ventas_mensual'
  ];
  const rowVals = [
    config.trm,
    config.uvt,
    config.smmlv,
    config.tope_no_declarante_uvt,
    config.tope_no_paga_renta_uvt,
    config.tope_responsable_iva_uvt,
    config.retencion_servicio_min_uvt,
    config.tarifa_ret_declarante,
    config.tarifa_ret_no_declarante,
    config.tarifa_salud,
    config.tarifa_pension,
    config.ibc_porcentaje,
    config.tarifa_iva,
    config.salario_propuesto,
    config.horas_objetivo_mes,
    config.meta_ventas_mensual
  ];

  await saveSheetTable(spreadsheetId, accessToken, 'Config', headers, [rowVals]);
}

export async function activeFinancialSpreadsheet(accessToken: string): Promise<string> {
  const existing = await findSpreadsheet(accessToken);
  return existing?.id || createSpreadsheet(accessToken);
}

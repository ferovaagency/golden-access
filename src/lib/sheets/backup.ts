/**
 * Backup/restore of the whole "Ferova_OS_Financiero" spreadsheet: Drive-copy
 * snapshots, restoring from a snapshot, and pushing the current Supabase
 * AppData into the sheet as a manual backup. Split out of sheetsService.ts
 * (Fase 3 del roadmap).
 */
import type { Respaldo, AppData } from '../../types';
import { findSpreadsheet } from './driveFiles';
import { createSpreadsheet } from './spreadsheetSchema';
import { fetchSpreadsheetData } from './spreadsheetRead';
import { saveSheetTable, updateConfigInSheet } from './spreadsheetWrite';

/**
 * Triggers Google Drive copy endpoint to duplicate the sheet.
 * Records the backup details in "Respaldos" worksheet.
 */
export async function createDriveBackup(
  spreadsheetId: string,
  accessToken: string,
  userEmail: string,
  currentRespaldos: Respaldo[]
): Promise<{ snapshotId: string; date: string }> {
  // 1. Request copy via Drive API
  const date = new Date().toISOString();
  const dateFormatted = date.replace(/:/g, '-').split('.')[0];
  const name = `Ferova_OS_Financiero_Respaldo_${dateFormatted}`;

  const copyUrl = `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/copy`;
  const copyRes = await fetch(copyUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!copyRes.ok) {
    throw new Error(`Error copiando el archivo en Drive: ${copyRes.statusText}`);
  }

  const copyData = await copyRes.json();
  const snapshotId = copyData.id;

  // 2. Append new row in "Respaldos" sheet
  const headers = ['fecha', 'usuario', 'snapshot_drive_id'];
  const newRow = [date, userEmail, snapshotId];

  const allRows = currentRespaldos.map(r => [r.fecha, r.usuario, r.snapshot_drive_id]);
  allRows.push(newRow);

  await saveSheetTable(spreadsheetId, accessToken, 'Respaldos', headers, allRows);

  return { snapshotId, date };
}

/**
 * Restores the current spreadsheet content by copying the data from a backup snapshot spreadsheet ID.
 */
export async function restoreFromBackup(
  activeSpreadsheetId: string,
  backupSpreadsheetId: string,
  accessToken: string
): Promise<AppData> {
  // 1. Fetch data from the backup file
  const backupData = await fetchSpreadsheetData(backupSpreadsheetId, accessToken);

  // 2. Overwrite sheets of the current active file with this data
  // Write Clientes
  {
    const headers = ['id', 'nombre', 'tipo', 'declarante', 'activo', 'fecha_creacion', 'notas', 'marca_info', 'objetivos', 'kpis', 'entregables', 'progreso', 'responsable'];
    const rows = backupData.clientes.map(c => [
      c.id, c.nombre, c.tipo, c.declarante ? 'TRUE' : 'FALSE', c.activo ? 'TRUE' : 'FALSE', c.fecha_creacion, c.notas || '',
      c.marca_info || '', c.objetivos || '', c.kpis || '', c.entregables || '', c.progreso || 0, c.responsable || ''
    ]);
    await saveSheetTable(activeSpreadsheetId, accessToken, 'Clientes', headers, rows);
  }

  // Write Servicios
  {
    const headers = ['id', 'nombre', 'costo_unitario', 'descripcion'];
    const rows = backupData.servicios.map(s => [
      s.id, s.nombre, s.costo_unitario, s.descripcion || ''
    ]);
    await saveSheetTable(activeSpreadsheetId, accessToken, 'Servicios', headers, rows);
  }

  // Write Herramientas
  {
    const headers = ['id', 'nombre', 'monto', 'moneda', 'tipo_cobro', 'servicios_ids', 'notas'];
    const rows = backupData.herramientas.map(h => [
      h.id, h.nombre, h.monto, h.moneda, h.tipo_cobro, h.servicios_ids || '', h.notas || ''
    ]);
    await saveSheetTable(activeSpreadsheetId, accessToken, 'Herramientas', headers, rows);
  }

  // Write OtrosGastos
  {
    const headers = ['id', 'nombre', 'monto', 'moneda', 'categoria', 'comprobante_url', 'comprobante_nombre'];
    const rows = backupData.otrosGastos.map(g => [
      g.id, g.nombre, g.monto, g.moneda, g.categoria, g.comprobante_url || '', g.comprobante_nombre || ''
    ]);
    await saveSheetTable(activeSpreadsheetId, accessToken, 'OtrosGastos', headers, rows);
  }

  // Write Ventas
  {
    const headers = [
      'id', 'fecha', 'cliente_id', 'cliente_nombre', 'servicio_id', 'servicio_nombre',
      'cantidad', 'precio_venta_unitario', 'costo_unitario', 'moneda', 'tipo', 'adelanto', 'estado_pago', 'notas', 'abonos_log'
    ];
    const rows = backupData.ventas.map(v => [
      v.id, v.fecha, v.cliente_id, v.cliente_nombre, v.servicio_id, v.servicio_nombre,
      v.cantidad, v.precio_venta_unitario, v.costo_unitario, v.moneda, v.tipo, v.adelanto, v.estado_pago, v.notas || '',
      JSON.stringify(v.abonos || [])
    ]);
    await saveSheetTable(activeSpreadsheetId, accessToken, 'Ventas', headers, rows);
  }

  // Write Horas
  {
    const headers = ['id', 'fecha', 'cliente_id', 'cliente_nombre', 'servicio_id', 'servicio_nombre', 'horas', 'descripcion'];
    const rows = backupData.horas.map(h => [
      h.id, h.fecha, h.cliente_id, h.cliente_nombre, h.servicio_id, h.servicio_nombre, h.horas, h.descripcion
    ]);
    await saveSheetTable(activeSpreadsheetId, accessToken, 'Horas', headers, rows);
  }

  // Write Respaldos
  {
    const headers = ['fecha', 'usuario', 'snapshot_drive_id'];
    const rows = backupData.respaldos.map(r => [
      r.fecha, r.usuario, r.snapshot_drive_id
    ]);
    await saveSheetTable(activeSpreadsheetId, accessToken, 'Respaldos', headers, rows);
  }

  // Write PagosEgresos
  {
    const headers = ['id', 'fecha', 'concepto', 'categoria', 'monto', 'moneda', 'metodo_pago', 'notas', 'comprobante_url', 'comprobante_nombre'];
    const rows = (backupData.pagosEgresos || []).map(p => [
      p.id, p.fecha, p.concepto, p.categoria, p.monto, p.moneda, p.metodo_pago, p.notas || '', p.comprobante_url || '', p.comprobante_nombre || ''
    ]);
    await saveSheetTable(activeSpreadsheetId, accessToken, 'PagosEgresos', headers, rows);
  }

  // Write Config
  await updateConfigInSheet(activeSpreadsheetId, accessToken, backupData.config);

  return backupData;
}

/**
 * Vuelca el AppData actual (que ahora viene de Supabase) hacia la hoja de
 * Google Sheets del usuario, como respaldo manual opcional. Encuentra o crea
 * "Ferova_OS_Financiero" y reutiliza saveSheetTable/updateConfigInSheet.
 */
export async function backupAppDataToSheets(
  appData: AppData,
  accessToken: string
): Promise<{ sheetId: string; sheetLink: string }> {
  let sheetId: string;
  let sheetLink: string;

  const existing = await findSpreadsheet(accessToken);
  if (existing) {
    sheetId = existing.id;
    sheetLink = existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}`;
  } else {
    sheetId = await createSpreadsheet(accessToken);
    sheetLink = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  }

  await updateConfigInSheet(sheetId, accessToken, appData.config);

  await saveSheetTable(sheetId, accessToken, 'Clientes',
    ['id', 'nombre', 'tipo', 'declarante', 'activo', 'fecha_creacion', 'notas', 'marca_info', 'objetivos', 'kpis', 'entregables', 'progreso', 'responsable'],
    appData.clientes.map(c => [
      c.id, c.nombre, c.tipo, c.declarante ? 'TRUE' : 'FALSE', c.activo ? 'TRUE' : 'FALSE', c.fecha_creacion,
      c.notas || '', c.marca_info || '', c.objetivos || '', c.kpis || '', c.entregables || '', c.progreso || 0, c.responsable || ''
    ])
  );

  await saveSheetTable(sheetId, accessToken, 'Servicios',
    ['id', 'nombre', 'costo_unitario', 'descripcion'],
    appData.servicios.map(s => [s.id, s.nombre, s.costo_unitario, s.descripcion || ''])
  );

  await saveSheetTable(sheetId, accessToken, 'Herramientas',
    ['id', 'nombre', 'monto', 'moneda', 'tipo_cobro', 'servicios_ids', 'notas'],
    appData.herramientas.map(h => [h.id, h.nombre, h.monto, h.moneda, h.tipo_cobro, h.servicios_ids || '', h.notas || ''])
  );

  await saveSheetTable(sheetId, accessToken, 'OtrosGastos',
    ['id', 'nombre', 'monto', 'moneda', 'categoria', 'comprobante_url', 'comprobante_nombre'],
    appData.otrosGastos.map(g => [g.id, g.nombre, g.monto, g.moneda, g.categoria, g.comprobante_url || '', g.comprobante_nombre || ''])
  );

  await saveSheetTable(sheetId, accessToken, 'Ventas',
    ['id', 'fecha', 'cliente_id', 'cliente_nombre', 'servicio_id', 'servicio_nombre', 'cantidad', 'precio_venta_unitario', 'costo_unitario', 'moneda', 'tipo', 'adelanto', 'estado_pago', 'notas', 'abonos_log'],
    appData.ventas.map(v => [
      v.id, v.fecha, v.cliente_id, v.cliente_nombre, v.servicio_id, v.servicio_nombre,
      v.cantidad, v.precio_venta_unitario, v.costo_unitario, v.moneda, v.tipo, v.adelanto, v.estado_pago, v.notas || '',
      JSON.stringify(v.abonos || [])
    ])
  );

  await saveSheetTable(sheetId, accessToken, 'Horas',
    ['id', 'fecha', 'cliente_id', 'cliente_nombre', 'servicio_id', 'servicio_nombre', 'horas', 'descripcion'],
    appData.horas.map(h => [h.id, h.fecha, h.cliente_id, h.cliente_nombre, h.servicio_id, h.servicio_nombre, h.horas, h.descripcion])
  );

  await saveSheetTable(sheetId, accessToken, 'PagosEgresos',
    ['id', 'fecha', 'concepto', 'categoria', 'monto', 'moneda', 'metodo_pago', 'notas', 'comprobante_url', 'comprobante_nombre'],
    appData.pagosEgresos.map(p => [p.id, p.fecha, p.concepto, p.categoria, p.monto, p.moneda, p.metodo_pago, p.notas || '', p.comprobante_url || '', p.comprobante_nombre || ''])
  );

  return { sheetId, sheetLink };
}

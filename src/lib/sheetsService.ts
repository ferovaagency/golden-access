import { Config, Cliente, Servicio, Herramienta, OtroGasto, Venta, Hora, Respaldo, AppData, PagoEgreso } from '../types';

/**
 * Searches Google Drive for a spreadsheet named "Ferova_OS_Financiero".
 * Returns spreadsheet details if found, or null otherwise.
 */
export async function findSpreadsheet(accessToken: string): Promise<{ id: string; webViewLink?: string } | null> {
  const q = encodeURIComponent("name = 'Ferova_OS_Financiero' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink)`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      throw new Error(`Error buscando archivo en Drive: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return {
        id: data.files[0].id,
        webViewLink: data.files[0].webViewLink,
      };
    }
    return null;
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') throw err;
    console.error('Error in findSpreadsheet:', err);
    return null;
  }
}

/**
 * Creates a brand new "Ferova_OS_Financiero" spreadsheet with all 8 sheets and returns its ID.
 */
export async function createSpreadsheet(accessToken: string): Promise<string> {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets';
  const body = {
    properties: {
      title: 'Ferova_OS_Financiero',
    },
    sheets: [
      { properties: { title: 'Config' } },
      { properties: { title: 'Clientes' } },
      { properties: { title: 'Servicios' } },
      { properties: { title: 'Herramientas' } },
      { properties: { title: 'OtrosGastos' } },
      { properties: { title: 'Ventas' } },
      { properties: { title: 'Horas' } },
      { properties: { title: 'Respaldos' } },
      { properties: { title: 'PagosEgresos' } },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Error creando hoja de cálculo: ${res.statusText}`);
  }

  const result = await res.json();
  const spreadsheetId = result.spreadsheetId;

  // Now seed the spreadsheet with clean default values and headers
  await seedSpreadsheet(spreadsheetId, accessToken);

  return spreadsheetId;
}

/**
 * Seeds the fresh spreadsheet with default columns and sample data for 2026.
 */
export async function seedSpreadsheet(spreadsheetId: string, accessToken: string) {
  const dateStr = new Date().toISOString().split('T')[0];

  const valueRanges = [
    {
      range: 'Config!A1:P2',
      values: [
        [
          'trm', 'uvt', 'smmlv', 'tope_no_declarante_uvt', 'tope_no_paga_renta_uvt', 'tope_responsable_iva_uvt',
          'retencion_servicio_min_uvt', 'tarifa_ret_declarante', 'tarifa_ret_no_declarante', 'tarifa_salud',
          'tarifa_pension', 'ibc_porcentaje', 'tarifa_iva', 'salario_propuesto', 'horas_objetivo_mes', 'meta_ventas_mensual'
        ],
        [
          4000, 52374, 1750905, 1400, 1090, 3500, 4, 0.04, 0.06, 0.125, 0.16, 0.40, 0.19, 4500000, 160, 15000000
        ]
      ]
    },
    {
      range: 'Clientes!A1:G3',
      values: [
        ['id', 'nombre', 'tipo', 'declarante', 'activo', 'fecha_creacion', 'notas'],
        ['c1', 'Ruta N Medellín', 'Nacional', 'TRUE', 'TRUE', dateStr, 'Cliente nacional declarante de renta.'],
        ['c2', 'SaaS Corp Miami', 'Internacional', 'FALSE', 'TRUE', dateStr, 'Cliente pago recurrente en USD.']
      ]
    },
    {
      range: 'Servicios!A1:D4',
      values: [
        ['id', 'nombre', 'costo_unitario', 'descripcion'],
        ['s1', 'Aero-SEO Mensual', 400000, 'Servicio mensual de SEO & posicionamiento optimizado.'],
        ['s2', 'GEO & IA Optimization', 600000, 'Generative Engine Optimization para buscadores de LLM.'],
        ['s3', 'Asesor comercial IA', 1500000, 'Creación y montaje de chatbot con IA para ventas.']
      ]
    },
    {
      range: 'Herramientas!A1:G3',
      values: [
        ['id', 'nombre', 'monto', 'moneda', 'tipo_cobro', 'servicios_ids', 'notas'],
        ['h1', 'SEMrush Suite', 130, 'USD', 'global', 's1,s2', 'Análisis de palabras clave y rankings.'],
        ['h2', 'OpenAI API Token', 25, 'USD', 'porCliente', 's3', 'Tokens consumidos por el agente conversacional.']
      ]
    },
    {
      range: 'OtrosGastos!A1:E3',
      values: [
        ['id', 'nombre', 'monto', 'moneda', 'categoria'],
        ['g1', 'Auxiliar Contable', 400000, 'COP', 'Administrativo'],
        ['g2', 'Fibra óptica y Coworking', 250000, 'COP', 'Operativo']
      ]
    },
    {
      range: 'Ventas!A1:N4',
      values: [
        [
          'id', 'fecha', 'cliente_id', 'cliente_nombre', 'servicio_id', 'servicio_nombre',
          'cantidad', 'precio_venta_unitario', 'costo_unitario', 'moneda', 'tipo', 'adelanto', 'estado_pago', 'notas'
        ],
        [
          'v1', dateStr, 'c1', 'Ruta N Medellín', 's1', 'Aero-SEO Mensual',
          1, 4500000, 400000, 'COP', 'Nacional', 0, 'Pagado', 'Pago completo primer mes'
        ],
        [
          'v2', dateStr, 'c2', 'SaaS Corp Miami', 's3', 'Asesor comercial IA',
          1, 1500, 1500000, 'USD', 'Internacional', 500, 'Adelanto', '50% de avance del asistente IA.'
        ]
      ]
    },
    {
      range: 'Horas!A1:H3',
      values: [
        ['id', 'fecha', 'cliente_id', 'cliente_nombre', 'servicio_id', 'servicio_nombre', 'horas', 'descripcion'],
        ['ho1', dateStr, 'c1', 'Ruta N Medellín', 's1', 'Aero-SEO Mensual', 15, 'Auditoría SEO técnica'],
        ['ho2', dateStr, 'c2', 'SaaS Corp Miami', 's3', 'Asesor comercial IA', 22.5, 'Entrenamiento del modelo y prompts']
      ]
    },
    {
      range: 'Respaldos!A1:C1',
      values: [
        ['fecha', 'usuario', 'snapshot_drive_id']
      ]
    },
    {
      range: 'PagosEgresos!A1:H2',
      values: [
        ['id', 'fecha', 'concepto', 'categoria', 'monto', 'moneda', 'metodo_pago', 'notas'],
        ['p1', dateStr, 'Licencia SEMrush Mayo', 'Herramientas', 130, 'USD', 'Tarjeta de Crédito', 'Cobro automático mensual recurrente']
      ]
    }
  ];

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  const response = await fetch(updateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: valueRanges
    })
  });

  if (!response.ok) {
    throw new Error(`Error de siembra inicial: ${response.statusText}`);
  }
}

/**
 * Safe background helper to create a missing worksheet like PagosEgresos on-the-fly.
 */
export async function ensureSingleWorksheetExists(
  spreadsheetId: string,
  accessToken: string,
  sheetName: string
): Promise<void> {
  try {
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const res = await fetch(updateUrl, {
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

    if (res.ok) {
      console.log(`Worksheet '${sheetName}' successfully created.`);
      const headers = ['id', 'fecha', 'concepto', 'categoria', 'monto', 'moneda', 'metodo_pago', 'notas'];
      const seedUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:H1?valueInputOption=USER_ENTERED`;
      await fetch(seedUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [headers] })
      });
    } else {
      const errInfo = await res.json().catch(() => ({}));
      console.warn(`Worksheet '${sheetName}' creation skipped (might already exist):`, errInfo);
    }
  } catch (err) {
    console.error(`Dynamic creation of sheet ${sheetName} failed:`, err);
  }
}

/**
 * Fetches all ranges from our sheets at once with graceful 8-sheet fallback.
 */
export async function fetchSpreadsheetData(spreadsheetId: string, accessToken: string): Promise<AppData> {
  const coreSheets = [
    { name: 'Config', range: 'Config!A1:P2' },
    { name: 'Clientes', range: 'Clientes!A1:Z2000' },
    { name: 'Servicios', range: 'Servicios!A1:Z2000' },
    { name: 'Herramientas', range: 'Herramientas!A1:Z2000' },
    { name: 'OtrosGastos', range: 'OtrosGastos!A1:Z2000' },
    { name: 'Ventas', range: 'Ventas!A1:Z5000' },
    { name: 'Horas', range: 'Horas!A1:Z5000' },
    { name: 'Respaldos', range: 'Respaldos!A1:Z1000' },
    { name: 'PagosEgresos', range: 'PagosEgresos!A1:Z5000' }
  ];

  let valueRanges: any[] = [];
  let loadedAllNine = false;

  try {
    // 1. Try to fetch all 9 sheets in a single request (highly efficient)
    const queryParams = coreSheets.map(item => `ranges=${encodeURIComponent(item.range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryParams}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) {
      const data = await res.json();
      valueRanges = data.valueRanges || [];
      loadedAllNine = true;
    } else {
      console.warn(`Fetch with 9 sheets returned status ${res.status}. Falling back to 8 core sheets.`);
    }
  } catch (err) {
    console.warn("9-sheets direct fetch threw error, using fallback:", err);
  }

  // 2. If 9-sheets fetch failed (e.g. PagosEgresos sheet does not exist yet), fall back to only the 8 known core sheets
  if (!loadedAllNine) {
    const fallbackSheets = coreSheets.slice(0, 8);
    const queryParams = fallbackSheets.map(item => `ranges=${encodeURIComponent(item.range)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${queryParams}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Error trayendo datos de Sheets (8 core sheets): ${res.statusText || 'Respuesta no exitosa'}`);
    }

    const data = await res.json();
    valueRanges = data.valueRanges || [];

    // Trigger asynchronous creation of the missing 'PagosEgresos' sheet in the background so it exists next time
    ensureSingleWorksheetExists(spreadsheetId, accessToken, 'PagosEgresos').catch(err => {
      console.error("Background auto-upgrade of 'PagosEgresos' failed:", err);
    });
  }

  // Robustly extract sheet values by matching the range title self-descriptively
  const findValuesForSheet = (sheetName: string): any[][] => {
    const normSheet = sheetName.replace(/'/g, '').toLowerCase();
    const found = valueRanges.find((vr: any) => {
      if (!vr.range) return false;
      const cleanRange = vr.range.replace(/'/g, '').toLowerCase();
      return cleanRange.startsWith(`${normSheet}!`);
    });
    return found?.values || [];
  };

  const rawConfig = findValuesForSheet('Config');
  const rawClientes = findValuesForSheet('Clientes');
  const rawServicios = findValuesForSheet('Servicios');
  const rawHerramientas = findValuesForSheet('Herramientas');
  const rawOtrosGastos = findValuesForSheet('OtrosGastos');
  const rawVentas = findValuesForSheet('Ventas');
  const rawHoras = findValuesForSheet('Horas');
  const rawRespaldos = findValuesForSheet('Respaldos');
  const rawPagosEgresos = findValuesForSheet('PagosEgresos');

  // 1. Config
  const configHeaders = rawConfig[0] || [];
  const configVals = rawConfig[1] || [];
  const configMap: any = {};
  configHeaders.forEach((header: string, idx: number) => {
    configMap[header] = configVals[idx] !== undefined ? Number(configVals[idx]) : 0;
  });

  // Fallback defaults if config headers are broken
  const config: Config = {
    trm: configMap.trm ?? 4000,
    uvt: configMap.uvt ?? 52374,
    smmlv: configMap.smmlv ?? 1750905,
    tope_no_declarante_uvt: configMap.tope_no_declarante_uvt ?? 1400,
    tope_no_paga_renta_uvt: configMap.tope_no_paga_renta_uvt ?? 1090,
    tope_responsable_iva_uvt: configMap.tope_responsable_iva_uvt ?? 3500,
    retencion_servicio_min_uvt: configMap.retencion_servicio_min_uvt ?? 4,
    tarifa_ret_declarante: configMap.tarifa_ret_declarante ?? 0.04,
    tarifa_ret_no_declarante: configMap.tarifa_ret_no_declarante ?? 0.06,
    tarifa_salud: configMap.tarifa_salud ?? 0.125,
    tarifa_pension: configMap.tarifa_pension ?? 0.16,
    ibc_porcentaje: configMap.ibc_porcentaje ?? 0.40,
    tarifa_iva: configMap.tarifa_iva ?? 0.19,
    salario_propuesto: configMap.salario_propuesto ?? 4000000,
    horas_objetivo_mes: configMap.horas_objetivo_mes ?? 160,
    meta_ventas_mensual: configMap.meta_ventas_mensual ?? 12000000,
  };

  // 2. Clientes mapping
  const clientes: Cliente[] = parseTable(rawClientes, (row) => ({
    id: row[0] || '',
    nombre: row[1] || '',
    tipo: (row[2] === 'Internacional' ? 'Internacional' : 'Nacional') as 'Nacional' | 'Internacional',
    declarante: row[3] === 'TRUE',
    activo: row[4] !== 'FALSE', // default true unless explicitly FALSE
    fecha_creacion: row[5] || '',
    notas: row[6] || '',
    marca_info: row[7] || '',
    objetivos: row[8] || '',
    kpis: row[9] || '',
    entregables: row[10] || '',
    progreso: Number(row[11]) || 0,
    responsable: row[12] || '',
  }));

  // 3. Servicios mapping
  const servicios: Servicio[] = parseTable(rawServicios, (row) => ({
    id: row[0] || '',
    nombre: row[1] || '',
    costo_unitario: Number(row[2]) || 0,
    descripcion: row[3] || '',
  }));

  // 4. Herramientas mapping
  const herramientas: Herramienta[] = parseTable(rawHerramientas, (row) => ({
    id: row[0] || '',
    nombre: row[1] || '',
    monto: Number(row[2]) || 0,
    moneda: (row[3] === 'USD' ? 'USD' : 'COP') as 'COP' | 'USD',
    tipo_cobro: (row[4] === 'porCliente' ? 'porCliente' : 'global') as 'global' | 'porCliente',
    servicios_ids: row[5] || '',
    notas: row[6] || '',
  }));

  // 5. Otros Gastos mapping
  const otrosGastos: OtroGasto[] = parseTable(rawOtrosGastos, (row) => ({
    id: row[0] || '',
    nombre: row[1] || '',
    monto: Number(row[2]) || 0,
    moneda: (row[3] === 'USD' ? 'USD' : 'COP') as 'COP' | 'USD',
    categoria: (row[4] === 'Administrativo' || row[4] === 'Operativo' || row[4] === 'Otros' ? row[4] : 'Otros') as 'Operativo' | 'Administrativo' | 'Otros',
  }));

  // 6. Ventas mapping
  const ventas: Venta[] = parseTable(rawVentas, (row) => {
    let parsedAbonos = [];
    try {
      if (row[14]) {
        parsedAbonos = JSON.parse(row[14]);
      }
    } catch (e) {
      console.warn('Error parseando abonos_log', e);
    }
    return {
      id: row[0] || '',
      fecha: row[1] || '',
      cliente_id: row[2] || '',
      cliente_nombre: row[3] || '',
      servicio_id: row[4] || '',
      servicio_nombre: row[5] || '',
      cantidad: Number(row[6]) || 1,
      precio_venta_unitario: Number(row[7]) || 0,
      costo_unitario: Number(row[8]) || 0,
      moneda: (row[9] === 'USD' ? 'USD' : 'COP') as 'COP' | 'USD',
      tipo: (row[10] === 'Internacional' ? 'Internacional' : 'Nacional') as 'Nacional' | 'Internacional',
      adelanto: Number(row[11]) || 0,
      estado_pago: (row[12] === 'Adelanto' || row[12] === 'Pagado' ? row[12] : 'Pendiente') as 'Pendiente' | 'Adelanto' | 'Pagado',
      notas: row[13] || '',
      abonos: parsedAbonos,
    };
  });

  // 7. Horas mapping
  const horas: Hora[] = parseTable(rawHoras, (row) => ({
    id: row[0] || '',
    fecha: row[1] || '',
    cliente_id: row[2] || '',
    cliente_nombre: row[3] || '',
    servicio_id: row[4] || '',
    servicio_nombre: row[5] || '',
    horas: Number(row[6]) || 0,
    descripcion: row[7] || '',
  }));

  // 8. Respaldos mapping
  const respaldos: Respaldo[] = parseTable(rawRespaldos, (row) => ({
    fecha: row[0] || '',
    usuario: row[1] || '',
    snapshot_drive_id: row[2] || '',
  }));

  // 9. PagosEgresos mapping
  const pagosEgresos: PagoEgreso[] = parseTable(rawPagosEgresos, (row) => ({
    id: row[0] || '',
    fecha: row[1] || '',
    concepto: row[2] || '',
    categoria: (row[3] || 'Otros') as 'Herramientas' | 'Salarios' | 'Contratistas' | 'Administrativo' | 'Otros',
    monto: Number(row[4]) || 0,
    moneda: (row[5] === 'USD' ? 'USD' : 'COP') as 'COP' | 'USD',
    metodo_pago: row[6] || '',
    notas: row[7] || '',
  }));

  return {
    config,
    clientes,
    servicios,
    herramientas,
    otrosGastos,
    ventas,
    horas,
    respaldos,
    pagosEgresos,
  };
}

/**
 * Helper to dismiss headers row and map items
 */
function parseTable<T>(rawRows: any[][], mapper: (row: any[]) => T): T[] {
  if (rawRows.length <= 1) return [];
  // Skip row 0 (headers) and filter out empty rows
  return rawRows
    .slice(1)
    .filter(row => row && row.length > 0 && row[0] !== undefined && String(row[0]).trim() !== '')
    .map(mapper);
}

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
    const headers = ['id', 'nombre', 'monto', 'moneda', 'categoria'];
    const rows = backupData.otrosGastos.map(g => [
      g.id, g.nombre, g.monto, g.moneda, g.categoria
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
    const headers = ['id', 'fecha', 'concepto', 'categoria', 'monto', 'moneda', 'metodo_pago', 'notas'];
    const rows = (backupData.pagosEgresos || []).map(p => [
      p.id, p.fecha, p.concepto, p.categoria, p.monto, p.moneda, p.metodo_pago, p.notas || ''
    ]);
    await saveSheetTable(activeSpreadsheetId, accessToken, 'PagosEgresos', headers, rows);
  }

  // Write Config
  await updateConfigInSheet(activeSpreadsheetId, accessToken, backupData.config);

  return backupData;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  webViewLink?: string;
  trashed: boolean;
  modifiedTime?: string;
}

/**
 * Searches the user's entire Google Drive for files whose name contain "Ferova_OS_Financiero".
 * Includes trashed files so the user can easily recover them.
 */
export async function searchAllRelatedSpreadsheets(accessToken: string): Promise<DriveFileInfo[]> {
  const q = encodeURIComponent("name contains 'Ferova_OS_Financiero' and mimeType = 'application/vnd.google-apps.spreadsheet'");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,trashed,modifiedTime)&orderBy=modifiedTime desc`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      throw new Error(`Error Consultando Drive: ${res.statusText}`);
    }

    const data = await res.json();
    return data.files || [];
  } catch (err: any) {
    console.error('Error in searchAllRelatedSpreadsheets:', err);
    throw err;
  }
}

/**
 * Restores a file from the Google Drive trash (untrashes it).
 */
export async function untrashSpreadsheet(accessToken: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: false }),
  });

  if (!res.ok) {
    throw new Error(`Error al recuperar archivo de la papelera: ${res.statusText}`);
  }
}



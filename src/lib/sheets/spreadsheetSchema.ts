/**
 * Creation/seeding of the "Ferova_OS_Financiero" spreadsheet schema itself
 * (the 9 worksheets and their headers). Split out of sheetsService.ts
 * (Fase 3 del roadmap).
 */

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

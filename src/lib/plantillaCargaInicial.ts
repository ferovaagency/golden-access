// Plantilla de carga inicial: un solo libro de Excel con una hoja por cosa,
// para montar un cliente nuevo en una sentada en vez de ir pantalla por
// pantalla.
//
// Se genera en SpreadsheetML 2003 — XML plano que Excel, LibreOffice y Google
// Sheets abren nativamente. Un .xlsx de verdad es un ZIP y obligaría a meter una
// librería (y su peso) en el paquete para hacer exactamente lo mismo: dar una
// cuadrícula con los encabezados correctos.
//
// Los encabezados son EXACTAMENTE los que aceptan los importadores de
// csvImportExport, y además el lector tolera mayúsculas, tildes y `;`, así que
// guardar cada hoja como CSV y subirla funciona sin retoques.

interface Hoja {
  nombre: string;
  columnas: string[];
  ejemplo: string[];
  /** Qué hace cada columna, en el orden de `columnas`. */
  ayuda: string[];
}

const HOJAS: Hoja[] = [
  {
    nombre: 'Clientes',
    columnas: ['id', 'nombre', 'tipo', 'declarante', 'activo', 'notas'],
    ejemplo: ['', 'Acme S.A.S.', 'Nacional', 'TRUE', 'TRUE', 'Contacto: Ana'],
    ayuda: [
      'Déjalo vacío: se genera solo. Sólo se llena para ACTUALIZAR un cliente que ya existe.',
      'Obligatorio. El nombre con el que lo reconoces.',
      'Nacional o Internacional. Cambia la retención y los impuestos.',
      'TRUE si el cliente es declarante de renta; si no lo sabes, TRUE.',
      'TRUE si sigue siendo cliente hoy.',
      'Opcional.',
    ],
  },
  {
    nombre: 'Productos y servicios',
    columnas: ['id', 'nombre', 'costo_unitario', 'margen_objetivo_pct', 'precio_habitual', 'precio_habitual_moneda'],
    ejemplo: ['', 'Monitor 24"', '320000', '35', '450000', 'COP'],
    ayuda: [
      'Déjalo vacío: se genera solo.',
      'Obligatorio. Sirve igual para un producto que para un servicio.',
      'Obligatorio. Lo que te CUESTA a ti una unidad. Sin costo no se puede saber si ganas.',
      'Margen que buscas, en porcentaje (35 = 35%). Opcional.',
      'Precio al que sueles venderlo. Opcional, se puede cambiar en cada venta.',
      'COP o USD.',
    ],
  },
];

function esc(valor: string): string {
  return valor
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function celda(valor: string, estilo?: string): string {
  return `<Cell${estilo ? ` ss:StyleID="${estilo}"` : ''}><Data ss:Type="String">${esc(valor)}</Data></Cell>`;
}

function fila(celdas: string): string {
  return `<Row>${celdas}</Row>`;
}

function hojaXml(hoja: Hoja): string {
  const filas = [
    fila(hoja.columnas.map((c) => celda(c, 'encabezado')).join('')),
    fila(hoja.ejemplo.map((v) => celda(v)).join('')),
    // Fila en blanco para separar el ejemplo de la ayuda.
    fila(''),
    fila(celda('Qué va en cada columna:', 'nota')),
    ...hoja.columnas.map((c, i) => fila(celda(c, 'nota') + celda(hoja.ayuda[i] ?? ''))),
  ].join('');
  return `<Worksheet ss:Name="${esc(hoja.nombre)}"><Table>${filas}</Table></Worksheet>`;
}

function instruccionesXml(): string {
  const lineas = [
    'Plantilla de carga inicial de Ferova One',
    '',
    'Cómo usarla:',
    '1. Llena una hoja por vez. Borra la fila de ejemplo y las de ayuda antes de subir.',
    '2. Empieza por Clientes y sigue con Productos y servicios: las ventas se apoyan en ambos.',
    '3. Guarda cada hoja como CSV (Archivo → Guardar como → CSV) y súbela en su pantalla:',
    '   Clientes → pestaña Clientes → Importar CSV',
    '   Productos y servicios → pestaña Servicios → Importar CSV',
    '',
    'Sobre los números: escríbelos como quieras (300.000 o 300000). El importador',
    'entiende el formato colombiano, y el separador da igual: coma o punto y coma.',
    '',
    'Deja el id vacío salvo que quieras ACTUALIZAR algo que ya está cargado.',
    'Una fila sin nombre se salta. Un producto sin costo se salta: sin costo no se',
    'puede calcular el margen, y guardarlo en cero haría creer que todo es ganancia.',
  ];
  const filas = lineas.map((l) => fila(celda(l, l === lineas[0] ? 'titulo' : undefined))).join('');
  return `<Worksheet ss:Name="Instrucciones"><Table>${filas}</Table></Worksheet>`;
}

export function construirPlantillaXml(): string {
  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="encabezado"><Font ss:Bold="1"/><Interior ss:Color="#E8EEF7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="titulo"><Font ss:Bold="1" ss:Size="14"/></Style>
  <Style ss:ID="nota"><Font ss:Italic="1" ss:Color="#555555"/></Style>
 </Styles>
 ${instruccionesXml()}
 ${HOJAS.map(hojaXml).join('\n ')}
</Workbook>`;
}

export function downloadPlantillaCargaInicial(): void {
  const blob = new Blob(['﻿' + construirPlantillaXml()], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ferova_carga_inicial.xls';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

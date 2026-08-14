import assert from 'node:assert/strict';
import { parseClientesCsv, parseServiciosCsv } from '../src/lib/csvImportExport';

// El fallo real que reportó un cliente al instalar: "no importa cómo lo suba,
// dice que falta el nombre". La causa era el separador — Excel en español
// guarda con `;` — y que el encabezado se comparaba tal cual, sin normalizar.

// 1. Punto y coma (Excel en español) + BOM + mayúsculas y tildes.
const clientesEsp = '﻿Nombre;Tipo;Activo\r\nAcme S.A.S.;Nacional;TRUE\r\nGlobal Corp;Internacional;TRUE\r\n';
const clientes = parseClientesCsv(clientesEsp, []);
assert.equal(clientes.length, 2);
assert.equal(clientes[0].nombre, 'Acme S.A.S.');
assert.equal(clientes[1].tipo, 'Internacional');

// 2. Coma, encabezados en minúscula: el formato de la plantilla sigue valiendo.
const clientesComa = 'id,nombre,tipo,declarante,activo,notas\n,Solo Nombre,Nacional,TRUE,TRUE,\n';
assert.equal(parseClientesCsv(clientesComa, []).length, 1);

// 3. Alias habituales: quien exporta de otro sistema trae "Razón social".
const clientesAlias = 'Razón Social;Activo\nCliente Alias;TRUE\n';
assert.equal(parseClientesCsv(clientesAlias, [])[0].nombre, 'Cliente Alias');

// 4. Sin columna de nombre: el error debe DECIR qué encabezados leyó, para que
//    se pueda arreglar sin adivinar.
assert.throws(
  () => parseClientesCsv('telefono;correo\n123;a@b.co\n', []),
  (err: Error) => err.message.includes('telefono') && err.message.includes('correo'),
);

// 5. Servicios: mismo tratamiento, con costo obligatorio.
const servicios = parseServiciosCsv('Nombre;Costo Unitario;Precio Habitual\nSEO mensual;300000;950000\n', []);
assert.equal(servicios.length, 1);
assert.equal(servicios[0].costo_unitario, 300000);
assert.equal(servicios[0].precio_habitual, 950000);

// 6. Formato de número colombiano: "300.000" son trescientos mil, no
//    trescientos. `Number()` a secas se comía tres ceros de cada precio.
const conMiles = parseServiciosCsv('nombre;costo_unitario;precio_habitual\nDiseño;300.000;1.250.000\n', []);
assert.equal(conMiles[0].costo_unitario, 300000);
assert.equal(conMiles[0].precio_habitual, 1250000);

// 7. Decimales con coma, que es como los escribe Excel en español.
assert.equal(parseServiciosCsv('nombre;costo_unitario\nHora;35,50\n', [])[0].costo_unitario, 35.5);

// 8. Una fila con nombre pero sin costo se salta, no rompe el archivo entero.
const parciales = parseServiciosCsv('nombre;costo_unitario\nBueno;100\nSin costo;\n', []);
assert.equal(parciales.length, 1);
assert.equal(parciales[0].nombre, 'Bueno');

console.log('csvImport: ok');

import assert from 'node:assert/strict';
import { construirPlantillaXml } from '../src/lib/plantillaCargaInicial';
import { parseClientesCsv, parseServiciosCsv } from '../src/lib/csvImportExport';

const xml = construirPlantillaXml();

// Es un libro con sus hojas, no un CSV disfrazado.
assert.ok(xml.startsWith('<?xml'));
assert.ok(xml.includes('ss:Name="Instrucciones"'));
assert.ok(xml.includes('ss:Name="Clientes"'));
assert.ok(xml.includes('ss:Name="Productos y servicios"'));

// XML válido en lo que importa: nada de comillas o & sueltos rompiendo el
// archivo. El nombre con comillas del ejemplo ("Monitor 24\"") es justo el caso
// que lo rompería sin escapar.
assert.ok(!/<Data ss:Type="String">[^<]*"[^<]*<\/Data>/.test(xml), 'hay comillas sin escapar dentro de una celda');
assert.equal((xml.match(/<Worksheet/g) || []).length, (xml.match(/<\/Worksheet>/g) || []).length);

// LO IMPORTANTE: los encabezados de la plantilla tienen que ser los que el
// importador acepta. Si alguien renombra una columna en un lado y no en el
// otro, la plantilla deja de servir y nadie se entera hasta que un cliente lo
// sufre. Se comprueba pasando por el importador de verdad.
const clientes = parseClientesCsv('id,nombre,tipo,declarante,activo,notas\n,Acme S.A.S.,Nacional,TRUE,TRUE,Contacto: Ana\n', []);
assert.equal(clientes.length, 1);
assert.equal(clientes[0].nombre, 'Acme S.A.S.');

const servicios = parseServiciosCsv('id,nombre,costo_unitario,margen_objetivo_pct,precio_habitual,precio_habitual_moneda\n,Monitor 24,320000,35,450000,COP\n', []);
assert.equal(servicios.length, 1);
assert.equal(servicios[0].costo_unitario, 320000);
assert.equal(servicios[0].precio_habitual, 450000);

console.log('plantillaCargaInicial: ok');

import assert from 'node:assert/strict';
import { matchClientName, parseCapture, parseSpanishDate } from '../supabase/functions/_shared/task-parser';

const today = '2026-09-30'; // miércoles

// --- fechas en español ---
assert.equal(parseSpanishDate('mañana', today), '2026-10-01');
assert.equal(parseSpanishDate('pasado mañana', today), '2026-10-02');
assert.equal(parseSpanishDate('hoy', today), '2026-09-30');
assert.equal(parseSpanishDate('el viernes', today), '2026-10-02');
assert.equal(parseSpanishDate('miércoles', today), '2026-10-07', 'mismo día de la semana = el de la próxima');
assert.equal(parseSpanishDate('15/10', today), '2026-10-15');
assert.equal(parseSpanishDate('15/01', today), '2027-01-15', 'sin año y ya pasó = año que viene');
assert.equal(parseSpanishDate('3 de noviembre', today), '2026-11-03');
assert.equal(parseSpanishDate('2026-12-01', today), '2026-12-01');
assert.equal(parseSpanishDate('cualquier cosa', today), null);

// --- la captura de la pantalla ---
const tasks = parseCapture('el roecket: reporte mensual para mañana\nSiana; tag de campañas de oliver, arreglar footer de oliver para mañana', today);
assert.equal(tasks.length, 3);
assert.deepEqual(tasks.map((t) => t.title), ['Reporte mensual', 'Tag de campañas de oliver', 'Arreglar footer de oliver']);
assert.deepEqual(tasks.map((t) => t.client_text), ['el roecket', 'Siana', 'Siana']);
assert.deepEqual(tasks.map((t) => t.deadline), ['2026-10-01', '2026-10-01', '2026-10-01'], 'la fecha del final aplica a toda la línea');

// --- cada tarea con su propia fecha, y " y " como separador ---
const mixed = parseCapture('Netpower: subir catálogo el viernes y revisar GA4 para hoy', today);
assert.deepEqual(mixed.map((t) => [t.title, t.deadline]), [['Subir catálogo', '2026-10-02'], ['Revisar GA4', '2026-09-30']]);

// --- sin cliente ni fecha: una línea, una tarea ---
const plain = parseCapture('- Pagar impuestos\n- Llamar a Juan', today);
assert.deepEqual(plain.map((t) => [t.title, t.client_text, t.deadline]), [['Pagar impuestos', null, null], ['Llamar a Juan', null, null]]);

// --- una hora no es un cliente ---
assert.equal(parseCapture('10:30 reunión con el banco', today)[0].client_text, null);

// --- clientes con errores de tecleo ---
const clients = [
  { id: 'rocket', nombre: 'El Rocket' },
  { id: 'siana', nombre: 'Siana Marketing' },
  { id: 'netpower', nombre: 'Netpower IT' },
  { id: 'natan-h', nombre: 'Natan Holding' },
  { id: 'natan-c', nombre: 'Natan Comercial' },
];
assert.equal(matchClientName('el roecket', clients)?.id, 'rocket');
assert.equal(matchClientName('Siana', clients)?.id, 'siana');
assert.equal(matchClientName('netpwoer', clients)?.id, 'netpower');
assert.equal(matchClientName('Natan', clients), null, 'empate entre dos clientes = no adivinar');
assert.equal(matchClientName('Natan Comercial', clients)?.id, 'natan-c');
assert.equal(matchClientName('Juan', clients), null);

console.log('task parser: ok');

import assert from 'node:assert/strict';
import { importFromContent, toIsoDate } from '../src/lib/notionImport';

// Fechas: Notion exporta en español, ISO o dd/mm/yyyy según la vista.
assert.equal(toIsoDate('3 de septiembre de 2026'), '2026-09-03');
assert.equal(toIsoDate('2026-09-03'), '2026-09-03');
assert.equal(toIsoDate('3/9/2026'), '2026-09-03');
assert.equal(toIsoDate('sin fecha'), null);

const clients = [
  { id: 'cli-1', nombre: 'Natan Comercial' },
  { id: 'cli-2', nombre: 'NetPower IT' },
];

const csv = [
  'Nombre,Estado,Fecha de entrega,Cliente',
  'Rehacer la landing,En curso,3 de septiembre de 2026,Natan Comercial',
  '"Auditoría SEO, fase 2",Sin empezar,2026-09-10,NetPower IT',
  'Migrar el correo,Listo,2026-08-01,NetPower IT',
  'Revisar contrato,En curso,,',
].join('\n');

const result = importFromContent(csv, clients, { csv: true });

// Un CSV con columnas no debe pasar por la IA: se construyen borradores exactos.
assert.ok(result.drafts, 'un CSV con columnas debe producir drafts, no líneas para la IA');
const drafts = result.drafts!;

// La fila "Listo" se omite; quedan 3.
assert.equal(drafts.length, 3);
assert.equal(result.omitidas, 1);

// El título respeta las comillas del CSV (la coma interna no parte la celda).
assert.deepEqual(drafts.map((d) => d.title), [
  'Rehacer la landing',
  'Auditoría SEO, fase 2',
  'Revisar contrato',
]);

// Regresión: la fecha del CSV debe llegar a scheduled_for, no sólo a
// detected_deadline. Si no, la revisión muestra la fecha vacía y las tareas
// nacen en backlog pese a venir fechadas desde Notion.
assert.equal(drafts[0].detected_deadline, '2026-09-03');
assert.equal(drafts[0].scheduled_for, '2026-09-03');
assert.equal(drafts[1].scheduled_for, '2026-09-10');
assert.equal(drafts[2].detected_deadline, null);
assert.equal(drafts[2].scheduled_for, null);

// El cliente se resuelve a un id real, que es lo que persiste la tarea.
assert.equal(drafts[0].client_ref, 'cli-1');
assert.equal(drafts[0].detected_client, 'Natan Comercial');
assert.equal(drafts[1].client_ref, 'cli-2');
assert.equal(drafts[2].client_ref, null);

// Todo borrador importado debe ser accionable: planner-classify sólo crea
// tarea para los tipos de ACTIONABLE, y 'task' es el que usa el import.
assert.ok(drafts.every((d) => d.detected_type === 'task'));

// Texto suelto (sin columnas) sí va a la IA como líneas.
const libre = importFromContent('- Llamar al contador\n- Cerrar el mes', clients);
assert.equal(libre.drafts, undefined);
assert.deepEqual(libre.lines, ['Llamar al contador', 'Cerrar el mes']);

console.log('notion import: ok');

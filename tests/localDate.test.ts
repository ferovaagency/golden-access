import assert from 'node:assert/strict';
import { todayLocal } from '../src/lib/localDate';

// 9 p.m. en Bogotá = 02:07 UTC del día siguiente: debe seguir siendo el 8.
assert.equal(todayLocal('America/Bogota', new Date('2026-10-09T02:07:00Z')), '2026-10-08');
// Fin de mes: 31 oct 11 p.m. Bogotá no salta a noviembre.
assert.equal(todayLocal('America/Bogota', new Date('2026-11-01T04:00:00Z')), '2026-10-31');
console.log('localDate: ok');

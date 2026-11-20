import assert from 'node:assert/strict';
import { parsePlanIntent, planIntentPath } from '../src/lib/planIntent';

// Lee plan y periodo válidos de la URL.
assert.deepEqual(parsePlanIntent('?plan=medio&periodo=anual'), { plan: 'medio', periodo: 'anual' });

// Asume mensual si el periodo falta o es inválido.
assert.deepEqual(parsePlanIntent('?plan=pro'), { plan: 'pro', periodo: 'mensual' });
assert.deepEqual(parsePlanIntent('?plan=medio&periodo=semanal'), { plan: 'medio', periodo: 'mensual' });

// Ignora planes que no existen o que no se venden.
assert.equal(parsePlanIntent('?plan=free'), null);
assert.equal(parsePlanIntent('?plan=intermedio'), null, 'los planes de oct 2026 ya no se venden');
assert.equal(parsePlanIntent(''), null);

// La ruta que pone la landing en el botón se vuelve a leer igual.
assert.equal(planIntentPath({ plan: 'medio', periodo: 'anual' }), '/app?plan=medio&periodo=anual');
assert.deepEqual(parsePlanIntent(planIntentPath({ plan: 'pro', periodo: 'mensual' }).split('?')[1]), { plan: 'pro', periodo: 'mensual' });

console.log('planIntent OK');

import assert from 'node:assert/strict';
import { parsePlanIntent, planIntentPath } from '../src/lib/planIntent';

// Lee plan y periodo válidos de la URL.
assert.deepEqual(parsePlanIntent('?plan=intermedio&periodo=anual'), { plan: 'intermedio', periodo: 'anual' });

// Asume mensual si el periodo falta o es inválido.
assert.deepEqual(parsePlanIntent('?plan=full'), { plan: 'full', periodo: 'mensual' });
assert.deepEqual(parsePlanIntent('?plan=basico&periodo=semanal'), { plan: 'basico', periodo: 'mensual' });

// Ignora planes que no existen o que no se venden.
assert.equal(parsePlanIntent('?plan=free'), null);
assert.equal(parsePlanIntent('?plan=pro'), null);
assert.equal(parsePlanIntent(''), null);

// La ruta que pone la landing en el botón se vuelve a leer igual.
assert.equal(planIntentPath({ plan: 'basico', periodo: 'anual' }), '/app?plan=basico&periodo=anual');
assert.deepEqual(parsePlanIntent(planIntentPath({ plan: 'full', periodo: 'mensual' }).split('?')[1]), { plan: 'full', periodo: 'mensual' });

console.log('planIntent OK');

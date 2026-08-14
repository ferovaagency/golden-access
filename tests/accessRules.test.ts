import assert from 'node:assert/strict';
import { subscriptionGrantsAccess } from '../src/lib/accessRules';

const ahora = new Date('2026-08-14T12:00:00Z');

// Sin fila de suscripción no hay acceso pagado.
assert.equal(subscriptionGrantsAccess(null, ahora), false);
assert.equal(subscriptionGrantsAccess(undefined, ahora), false);

// Activa y sin vencimiento: el caso normal de quien paga.
assert.equal(subscriptionGrantsAccess({ status: 'active', expires_at: null }, ahora), true);

// Activa con vencimiento futuro: entra.
assert.equal(subscriptionGrantsAccess({ status: 'active', expires_at: '2026-09-01T00:00:00Z' }, ahora), true);

// Activa pero VENCIDA: no entra. Es el caso que se cuela si nadie lo prueba —
// el estado quedó en 'active' porque un webhook no llegó, pero la fecha manda.
assert.equal(subscriptionGrantsAccess({ status: 'active', expires_at: '2026-08-13T23:59:00Z' }, ahora), false);

// Cancelada: no entra aunque la fecha de vencimiento siga en el futuro.
assert.equal(subscriptionGrantsAccess({ status: 'cancelled', expires_at: '2026-12-01T00:00:00Z' }, ahora), false);
assert.equal(subscriptionGrantsAccess({ status: 'paused', expires_at: null }, ahora), false);
assert.equal(subscriptionGrantsAccess({ status: null, expires_at: null }, ahora), false);

// Justo en el instante de vencer todavía entra: el corte es estrictamente
// posterior, no se le quita el acceso a alguien un segundo antes de tiempo.
assert.equal(subscriptionGrantsAccess({ status: 'active', expires_at: '2026-08-14T12:00:00Z' }, ahora), true);

// Una fecha corrupta no debe expulsar a quien sí paga: se prefiere dejar entrar
// y que se note por otro lado, antes que cortarle el acceso a un cliente.
assert.equal(subscriptionGrantsAccess({ status: 'active', expires_at: 'no-es-una-fecha' }, ahora), true);

console.log('accessRules: ok');

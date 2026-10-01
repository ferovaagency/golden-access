import assert from 'node:assert/strict';
import { comparePlannerTasks, isPlannerTaskEligible, plannerDateKey, plannerPriorityScore, plannerTaskAvailableDate, plannerUrgency } from '../src/lib/plannerScheduling';

assert.equal(plannerDateKey('2026-07-30T00:00:00+00:00'), '2026-07-30');
assert.equal(plannerDateKey('invalid'), null);

const automatic = new Set(['automatic-task']);
assert.equal(isPlannerTaskEligible('automatic-task', '2026-08-03', '2026-07-22', automatic), true);
assert.equal(isPlannerTaskEligible('manual-task', '2026-08-03', '2026-07-22', automatic), false);
assert.equal(isPlannerTaskEligible('manual-task', '2026-07-22', '2026-07-22', automatic), true);
assert.equal(isPlannerTaskEligible('unscheduled-task', null, '2026-07-22', automatic), true);

assert.equal(plannerTaskAvailableDate({ today: '2026-07-22', deadline: '2026-07-23', automaticallyScheduled: true }), '2026-07-22');
assert.equal(plannerTaskAvailableDate({ today: '2026-07-22', deadline: '2026-07-27', automaticallyScheduled: true }), '2026-07-24');
assert.equal(plannerTaskAvailableDate({ today: '2026-07-22', deadline: '2026-07-30', automaticallyScheduled: true }), '2026-07-26');
assert.equal(plannerTaskAvailableDate({ today: '2026-07-22', deadline: '2026-08-30', automaticallyScheduled: true }), '2026-08-16');
assert.equal(plannerTaskAvailableDate({ today: '2026-07-22', scheduledFor: '2026-08-03', deadline: '2026-08-30', automaticallyScheduled: false }), '2026-08-03');

// --- Priority Score (Pareto) ---
const today = '2026-07-22';
assert.equal(plannerUrgency(null, today), 1);
assert.equal(plannerUrgency('2026-07-10', today), 5, 'vencida = urgencia máxima');
assert.equal(plannerUrgency('2026-07-23', today), 5);
assert.equal(plannerUrgency('2026-07-25', today), 4);
assert.equal(plannerUrgency('2026-07-29', today), 3);
assert.equal(plannerUrgency('2026-09-01', today), 2);

const neutral = { financial_impact: 3, client_impact: 3, risk_score: 3, execution_ease: 3 };
assert.equal(plannerPriorityScore({ ...neutral, deadline: null }, today), 2.4);
assert.equal(plannerPriorityScore({ ...neutral, deadline: '2026-07-22' }, today), 3.6);
// Posponer sube el score: +0.2 por vez, tope +1.0.
assert.equal(plannerPriorityScore({ ...neutral, deadline: null, postponed_count: 2 }, today), 2.8);
assert.equal(plannerPriorityScore({ ...neutral, deadline: null, postponed_count: 9 }, today), 3.4);
// Entradas fuera de rango no rompen la fórmula.
assert.equal(plannerPriorityScore({ financial_impact: 99, client_impact: 0, risk_score: null, execution_ease: undefined, deadline: null }, today), 2.4 + 0.5 - 0.4);

// Orden: dinero manda sobre la prioridad manual; a igual score, la entrega más cercana.
const money = { id: 'cobro', deadline: '2026-08-30', financial_impact: 5, client_impact: 4, risk_score: 4, execution_ease: 3, postponed_count: 0 };
const cheap = { id: 'orden', deadline: '2026-07-24', financial_impact: 1, client_impact: 1, risk_score: 1, execution_ease: 5, postponed_count: 0 };
const twinA = { id: 'a', deadline: '2026-07-30', ...neutral, postponed_count: 0 };
const twinB = { id: 'b', deadline: '2026-07-28', ...neutral, postponed_count: 0 };
const ordered = [cheap, twinA, money, twinB].sort((a, b) => comparePlannerTasks(a, b, today)).map((t) => t.id);
assert.deepEqual(ordered, ['cobro', 'b', 'a', 'orden']);

console.log('planner scheduling eligibility + priority score: ok');

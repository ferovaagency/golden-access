import assert from 'node:assert/strict';
import { isPlannerTaskEligible, plannerDateKey, plannerTaskAvailableDate } from '../src/lib/plannerScheduling';

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

console.log('planner scheduling eligibility: ok');

import assert from 'node:assert/strict';
import { isPlannerTaskEligible, plannerDateKey } from '../src/lib/plannerScheduling';

assert.equal(plannerDateKey('2026-07-30T00:00:00+00:00'), '2026-07-30');
assert.equal(plannerDateKey('invalid'), null);

const automatic = new Set(['automatic-task']);
assert.equal(isPlannerTaskEligible('automatic-task', '2026-08-03', '2026-07-22', automatic), true);
assert.equal(isPlannerTaskEligible('manual-task', '2026-08-03', '2026-07-22', automatic), false);
assert.equal(isPlannerTaskEligible('manual-task', '2026-07-22', '2026-07-22', automatic), true);
assert.equal(isPlannerTaskEligible('unscheduled-task', null, '2026-07-22', automatic), true);

console.log('planner scheduling eligibility: ok');

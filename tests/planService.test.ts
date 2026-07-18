import assert from 'node:assert/strict';
import { getModules } from '../src/lib/planService';

const finance = getModules('finance', false);
assert.equal(finance.core_projects, true);
assert.equal(finance.finance, true);
assert.equal(finance.planner, false);
assert.equal(finance.crm, false);

const planner = getModules('planner', false);
assert.equal(planner.planner, true);
assert.equal(planner.finance, false);

const customized = getModules('custom', false, { planner: true, finance: true });
assert.equal(customized.core_projects, true);
assert.equal(customized.planner, true);
assert.equal(customized.finance, true);

const overrideDisabled = getModules('completo', false, { google_sheets: false });
assert.equal(overrideDisabled.google_sheets, false);

const team = getModules('projects', true);
assert.equal(team.advanced_analytics, true);
assert.equal(team.crm_ventas, true);

console.log('planService entitlements: ok');

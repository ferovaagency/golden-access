import assert from 'node:assert/strict';
import { getLimits, getModules, getPlanCatalog, minimumPlanFor, withinLimit } from '../src/lib/planService';

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

// --- Freemium + 3 niveles ---
const free = getModules('free', false);
assert.equal(free.planner, true);
assert.equal(free.finance, true);
assert.equal(free.ai_assistant, true);
assert.equal(free.google_calendar, false, 'Calendar es disparador de upgrade');
assert.equal(free.crm, false);
assert.equal(getModules(null, false).google_sheets, false, 'sin plan = Gratis');

const basico = getModules('basico', false);
assert.equal(basico.google_calendar, true);
assert.equal(basico.google_sheets, true);
assert.equal(basico.crm, false);

const intermedio = getModules('intermedio', false);
assert.equal(intermedio.crm, true);
assert.equal(intermedio.marketing_roi, true);
assert.equal(intermedio.team_management, false);

const full = getModules('full', false);
assert.equal(full.advanced_analytics, true);
assert.equal(full.team_management, true);

const limitsFree = getLimits('free', false);
assert.equal(limitsFree.tareas_semana, 15);
assert.equal(withinLimit(limitsFree, 'tareas_semana', 14, 1), true);
assert.equal(withinLimit(limitsFree, 'tareas_semana', 15, 1), false, 'la tarea 16 pide upgrade');
assert.equal(withinLimit(limitsFree, 'movimientos_mes', 20, 1), false, 'el movimiento 21 pide upgrade');
assert.equal(withinLimit(getLimits('basico', false), 'tareas_semana', 999, 1), true);
assert.equal(withinLimit(getLimits('free', true), 'tareas_semana', 999, 1), true, 'equipo interno sin topes');
assert.equal(withinLimit(getLimits('completo', false), 'movimientos_mes', 999, 1), true, 'legado sin topes nuevos');

assert.equal(minimumPlanFor({ entitlement: 'google_calendar' }), 'basico');
assert.equal(minimumPlanFor({ entitlement: 'crm' }), 'intermedio');
assert.equal(minimumPlanFor({ entitlement: 'team_management' }), 'full');
assert.equal(minimumPlanFor({ limit: 'tareas_semana' }), 'basico');
assert.equal(minimumPlanFor({ limit: 'proyectos_activos' }), 'intermedio');

const catalog = getPlanCatalog();
assert.deepEqual(catalog.map((p) => p.id), ['basico', 'intermedio', 'full']);
assert.deepEqual(catalog.map((p) => p.precioMensual), [19, 29, 99], 'mensual = prices de Paddle');
assert.deepEqual(catalog.map((p) => p.precioAnualTotal), [159, 249, 829], 'anual redondeado por Mafe');
assert.ok(catalog.every((p) => p.ahorroAnualPct >= 28 && p.ahorroAnualPct <= 31), 'anual ≈ 30 % menos');
assert.equal(catalog.filter((p) => p.destacado).length, 1);

console.log('planService entitlements + freemium: ok');

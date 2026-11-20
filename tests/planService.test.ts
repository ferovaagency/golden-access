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

// --- Gratis / Medio / Pro (nov 2026) + planes de oct 2026 que se conservan ---
const free = getModules('free', false);
assert.equal(free.planner, true);
assert.equal(free.finance, true);
assert.equal(free.ai_assistant, true);
assert.equal(free.google_calendar, false, 'Calendar es disparador de upgrade');
assert.equal(free.crm, false);
assert.equal(getModules(null, false).google_sheets, false, 'sin plan = Gratis');

const medio = getModules('medio', false);
assert.equal(medio.finance, true);
assert.equal(medio.google_calendar, true);
assert.equal(medio.google_sheets, true);
assert.equal(medio.crm, false, 'el CRM va en Pro');
assert.equal(medio.team_management, false);

const pro = getModules('pro', false);
assert.equal(pro.crm, true);
assert.equal(pro.marketing_roi, true);
assert.equal(pro.advanced_analytics, true);
assert.equal(pro.team_management, true);

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
assert.equal(withinLimit(limitsFree, 'movimientos_mes', 29, 1), true);
assert.equal(withinLimit(limitsFree, 'movimientos_mes', 30, 1), false, 'el movimiento 31 pide upgrade');
assert.equal(limitsFree.proyectos_activos, 2, 'Gratis: 2 clientes activos');
assert.equal(getLimits('medio', false).proyectos_activos, 10);
assert.equal(getLimits('medio', false).consultas_ia_mes, 150);
assert.equal(getLimits('pro', false).proyectos_activos, null);
assert.equal(getLimits('pro', false).miembros, 5);
assert.equal(withinLimit(getLimits('basico', false), 'tareas_semana', 999, 1), true);
assert.equal(withinLimit(getLimits('free', true), 'tareas_semana', 999, 1), true, 'equipo interno sin topes');
assert.equal(withinLimit(getLimits('completo', false), 'movimientos_mes', 999, 1), true, 'legado sin topes nuevos');

assert.equal(minimumPlanFor({ entitlement: 'google_calendar' }), 'medio');
assert.equal(minimumPlanFor({ entitlement: 'crm' }), 'pro');
assert.equal(minimumPlanFor({ entitlement: 'team_management' }), 'pro');
assert.equal(minimumPlanFor({ limit: 'tareas_semana' }), 'medio');
assert.equal(minimumPlanFor({ limit: 'proyectos_activos' }), 'pro', 'sin tope sólo en Pro');
assert.equal(minimumPlanFor({ limit: 'proyectos_activos', needed: 3 }), 'medio', 'el cliente 3 pide Medio');
assert.equal(minimumPlanFor({ limit: 'proyectos_activos', needed: 11 }), 'pro', 'el cliente 11 pide Pro');
// Los planes de oct 2026 conservan lo que tenían.
assert.equal(getLimits('basico', false).proyectos_activos, 3);
assert.equal(getLimits('intermedio', false).proyectos_activos, 10);
assert.equal(getModules('intermedio', false).crm, true);

const catalog = getPlanCatalog();
assert.deepEqual(catalog.map((p) => p.id), ['medio', 'pro']);
assert.deepEqual(catalog.map((p) => p.precioMensual), [20, 50]);
assert.deepEqual(catalog.map((p) => p.precioAnualTotal), [168, 420]);
assert.ok(catalog.every((p) => p.ahorroAnualPct >= 28 && p.ahorroAnualPct <= 31), 'anual ≈ 30 % menos');
assert.equal(catalog.filter((p) => p.destacado).length, 1);

console.log('planService Gratis / Medio / Pro: ok');

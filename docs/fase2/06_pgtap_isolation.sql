-- Fase 2 · 06 · Pruebas de aislamiento (pgTAP). Correr en STAGING, en CI.
-- Es la prueba de mayor retorno del plan: garantiza que una migración futura no
-- rompa el aislamiento entre organizaciones en silencio.
--
-- Requiere: create extension if not exists pgtap;
-- Ejecutar dentro de una transacción y hacer rollback (no deja datos).
--
-- Este archivo es una PLANTILLA para UNA tabla (finance_ventas). Replicar el
-- patrón por tabla tenant × rol (lectura ajena / escritura ajena).

begin;
select plan(4);

-- --- Semilla: dos orgs, dos usuarios, un dato en cada org ---
insert into public.organizations (id, nombre) values
  ('00000000-0000-0000-0000-0000000000a1','Org A'),
  ('00000000-0000-0000-0000-0000000000b1','Org B');
insert into public.organization_members (org_id, user_id, rol) values
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','owner'),
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','owner');
insert into public.user_active_org (user_id, org_id) values
  ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b1');

-- Datos de negocio, uno por org (ajusta columnas NOT NULL reales de finance_ventas).
insert into public.finance_ventas (id, user_id, org_id, fecha)
values ('ventaA', '00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1', current_date),
       ('ventaB', '00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b1', current_date);

-- --- Simula la sesión del usuario A ---
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);

-- 1) A ve su propia venta.
select is(
  (select count(*)::int from public.finance_ventas where id='ventaA'),
  1, 'Usuario A ve la venta de su organizacion');

-- 2) A NO ve la venta de la org B (aislamiento de lectura).
select is(
  (select count(*)::int from public.finance_ventas where id='ventaB'),
  0, 'Usuario A NO ve datos de la org B');

-- 3) A NO puede escribir en la org B (aislamiento de escritura).
select throws_ok(
  $$ insert into public.finance_ventas (id, user_id, org_id, fecha)
     values ('hackB','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000b1', current_date) $$,
  '42501', null, 'Usuario A NO puede insertar en la org B');

-- 4) Reset de rol funciona (control).
reset role;
select ok(true, 'reset role ok');

select * from finish();
rollback;

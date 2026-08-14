-- Que pagar una deuda o una cuenta por pagar aparezca en Pagos & Egresos.
--
-- EL PROBLEMA
-- El resultado real de caja sale SÓLO de `finance_pagos_egresos`. Las cuotas de
-- deuda (`finance_debt_payments`) y los pagos de cuentas por pagar vivían en sus
-- propias tablas, así que pagar una deuda no reducía la caja en ningún informe:
-- el dinero salía de verdad y el sistema no se enteraba.
--
-- `Payable.pago_egreso_id` y `DebtPayment.pago_egreso_id` ya existían con el
-- comentario de que el flujo de caja no cuenta doble cuando están presentes...
-- pero nadie los llenaba nunca. Este cambio los conecta.
--
-- POR QUÉ HACE FALTA `origen`
-- `savePagosEgresos` guarda la pantalla entera con un BORRAR TODO + INSERTAR.
-- Un egreso creado automáticamente desde una deuda desaparecería en cuanto
-- alguien editara cualquier gasto, sin previo aviso. Con `origen`, esa pantalla
-- sólo borra y reescribe lo suyo (`manual`), y lo que generan las deudas y las
-- cuentas por pagar queda a salvo — se edita desde donde nació.

alter table public.finance_pagos_egresos
  add column if not exists origen     text not null default 'manual',
  add column if not exists origen_ref text;

comment on column public.finance_pagos_egresos.origen is
  'manual = escrito en Pagos & Egresos. deuda / cuenta_por_pagar = generado al registrar ese pago; no se edita ni se borra desde esta pantalla.';
comment on column public.finance_pagos_egresos.origen_ref is
  'Id del pago de deuda o de la cuenta por pagar que lo generó.';

create index if not exists finance_pagos_egresos_origen_idx
  on public.finance_pagos_egresos(user_id, origen)
  where origen <> 'manual';

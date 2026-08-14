-- Distinguir un PRODUCTO de un SERVICIO en el catálogo.
--
-- El catálogo (`finance_servicios`) servía para las dos cosas, pero todo se
-- llamaba "servicio": quien vende productos tenía que registrar su venta
-- eligiendo un "servicio", y en el formulario no había forma de decir qué
-- estaba vendiendo. Con `tipo`, el catálogo se filtra y cada venta habla el
-- idioma del negocio.
--
-- La tabla NO se renombra ni se parte en dos: un producto y un servicio tienen
-- exactamente los mismos campos (nombre, costo unitario, precio habitual,
-- margen objetivo) y separarlos obligaría a duplicar la rentabilidad, las
-- ventas y los informes para nada.
--
-- Lo que ya existe queda como 'servicio', que es lo que era.

alter table public.finance_servicios
  add column if not exists tipo text not null default 'servicio';

do $$
begin
  alter table public.finance_servicios
    add constraint finance_servicios_tipo_valido check (tipo in ('producto', 'servicio'));
exception when duplicate_object then null;
end $$;

comment on column public.finance_servicios.tipo is
  'producto | servicio. Sólo cambia cómo se presenta y se filtra: los campos son los mismos.';

create index if not exists finance_servicios_tipo_idx
  on public.finance_servicios(user_id, tipo);

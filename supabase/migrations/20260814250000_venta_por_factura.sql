-- Venta con varios ítems: una factura, varias líneas.
--
-- El caso real: se vende un monitor, un teclado y la instalación en una sola
-- factura. Hasta ahora una venta era UNA línea (un servicio, una cantidad, un
-- precio), así que había que inventarse tres ventas sueltas y nada las unía.
--
-- POR QUÉ UNA COLUMNA Y NO UNA TABLA DE FACTURAS
-- Cada fila de `finance_ventas` YA es una línea completa: producto, cantidad,
-- precio y **costo unitario**. Lo único que faltaba era el hilo que las une.
-- Con `numero_factura` la factura se arma agrupando, y no hay que reescribir
-- nada de lo que hoy lee ventas — rentabilidad por servicio, márgenes, cuentas
-- por cobrar, informes y el asistente siguen funcionando sin tocarse. Una tabla
-- de facturas con sus ítems sería más ortodoxa y obligaría a migrar y reescribir
-- todo eso; se hará el día que hagan falta impuestos y numeración fiscal de
-- verdad, no para poder vender tres cosas juntas.
--
-- Las ventas que ya existen se quedan con `numero_factura` nulo: son facturas
-- de una sola línea y se muestran igual que siempre.

alter table public.finance_ventas
  add column if not exists numero_factura text;

comment on column public.finance_ventas.numero_factura is
  'Agrupa varias líneas en una misma factura. Nulo = venta de una sola línea.';

-- Buscar las líneas de una factura es la consulta nueva que hace la pantalla.
create index if not exists finance_ventas_factura_idx
  on public.finance_ventas(user_id, numero_factura)
  where numero_factura is not null;

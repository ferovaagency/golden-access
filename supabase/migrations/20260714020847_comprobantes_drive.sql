-- Comprobantes (factura pagada / pago recibido) subidos al Drive del propio
-- cliente. Solo se guarda el link -- el archivo vive en su Drive, no en
-- Supabase Storage (usa el scope drive.file ya pedido en el OAuth).
ALTER TABLE public.finance_otros_gastos
  ADD COLUMN comprobante_url TEXT,
  ADD COLUMN comprobante_nombre TEXT;

ALTER TABLE public.finance_pagos_egresos
  ADD COLUMN comprobante_url TEXT,
  ADD COLUMN comprobante_nombre TEXT;

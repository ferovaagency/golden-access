-- CRM propio del cliente (biz_crm_contactos): campos de un CRM de verdad.
-- Antes solo había nombre/empresa/tel/email/estado/valor/notas/próxima acción.
-- Se agregan fuente, sitio web, LinkedIn, cargo y probabilidad de cierre.
-- Aditivo y seguro.

alter table public.biz_crm_contactos
  add column if not exists canal_origen text,
  add column if not exists sitio_web text,
  add column if not exists linkedin text,
  add column if not exists cargo text,
  add column if not exists probabilidad integer;

-- Telefono de WhatsApp (opcional, por miembro del equipo) para recibir alertas
-- automaticas cuando linkedin-analyze detecta un lead "Hot" (score_potencial >= 70).
-- Se guarda en formato E.164 sin "+" (mismo formato que usa Evolution API, ej. "573001234567").
ALTER TABLE public.crm_team_members
  ADD COLUMN telefono_notificaciones TEXT;

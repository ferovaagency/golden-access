-- Guarda el customer id de Paddle (ctm_...) para que las páginas autenticadas
-- puedan inicializar Paddle.js con pwCustomer y habilitar Retain (recuperación
-- de pago, optimización de términos, flujo de cancelación in-app).
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS provider_customer_id text;

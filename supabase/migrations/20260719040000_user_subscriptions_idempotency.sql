-- Prevents duplicate subscription rows when a payment provider (PayPal IPN,
-- Paddle webhook) redelivers the same event -- a normal, expected occurrence
-- for webhook protocols, not an edge case.
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_provider_order_unique
  ON public.user_subscriptions(provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

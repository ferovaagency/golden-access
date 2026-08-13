-- Fix del webhook de Paddle: el upsert usa ON CONFLICT (provider, provider_order_id),
-- pero el único índice que lo respaldaba era PARCIAL (WHERE provider_order_id IS NOT NULL).
-- PostgreSQL no infiere un índice parcial como árbitro de ON CONFLICT sin repetir el
-- predicado (y supabase-js no lo envía) → error 42P10 → la activación fallaba con 500.
--
-- Lo convertimos en índice único TOTAL. Sigue siendo seguro: en un índice único los
-- NULL se consideran distintos, así que múltiples filas con provider_order_id NULL
-- siguen permitidas; y entre los no-nulos ya no había duplicados. El webhook siempre
-- inserta provider_order_id no-nulo, así que ahora el ON CONFLICT resuelve bien.

drop index if exists public.user_subscriptions_provider_order_unique;

create unique index if not exists user_subscriptions_provider_order_unique
  on public.user_subscriptions (provider, provider_order_id);

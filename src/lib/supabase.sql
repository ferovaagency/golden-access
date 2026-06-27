-- ============================================================
-- Ferova OS - Tabla de Suscripciones (Paywall PayPal)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('active','cancelled','pending')),
  provider text not null default 'paypal',
  provider_order_id text,
  amount_usd numeric(10,2),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists user_subscriptions_user_id_idx
  on public.user_subscriptions(user_id);

-- Grants requeridos por PostgREST
grant select, insert, update on public.user_subscriptions to authenticated;
grant all on public.user_subscriptions to service_role;

alter table public.user_subscriptions enable row level security;

-- Cada usuario solo ve / crea sus propias filas
create policy "Users read own subscriptions"
  on public.user_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own subscriptions"
  on public.user_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

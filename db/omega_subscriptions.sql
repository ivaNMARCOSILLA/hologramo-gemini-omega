-- Ejecutar únicamente en SQL Editor de tu proyecto Supabase, tras revisar.
-- Los clientes no pueden inventarse una suscripción: solo la API verificada con clave service_role puede escribir.
create table if not exists public.omega_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_subscription_id text unique not null,
  stripe_customer_id text,
  plan text not null check (plan in ('elite','studio','sovereign')),
  status text not null,
  period_end timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.omega_subscriptions enable row level security;
drop policy if exists "omega_user_read_own_subscription" on public.omega_subscriptions;
create policy "omega_user_read_own_subscription"
  on public.omega_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
-- NO crear políticas de insert/update/delete para usuarios finales.

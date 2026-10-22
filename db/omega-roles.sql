-- OMEGA: ejecuta UNA VEZ en Supabase SQL Editor, en TU proyecto.
-- No crea cuentas ni asigna roles por defecto.
create table if not exists public.omega_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('member','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.omega_user_roles enable row level security;
revoke all on table public.omega_user_roles from anon, authenticated;
grant select on table public.omega_user_roles to authenticated;

drop policy if exists omega_role_read_self on public.omega_user_roles;
create policy omega_role_read_self on public.omega_user_roles
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- No se conceden INSERT, UPDATE ni DELETE a usuarios o visitantes.
-- La promoción de administradores se hace desde el SQL Editor de Supabase.
